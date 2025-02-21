import pyodbc
import hashlib
import requests
import json
from config import AZURE_SQL_CONNECTION_STRING, TENANT_ID, CLIENT_ID, CLIENT_SECRET
from datetime import datetime

#### USED TO LOGIN INTO ADMIN
def get_db_connection():
    """Establish a connection to Azure SQL Database using a single function."""
    try:
        return pyodbc.connect(AZURE_SQL_CONNECTION_STRING)
    except Exception as e:
        print("❌ Database connection error:", e)
        return None 

def authenticate_user(email, password):
    """Verify user credentials against the database without exposing password details."""
    conn = get_db_connection()  
    if not conn:
        print("❌ ERROR: Database connection failed.")
        return None
    cursor = conn.cursor()
    try:
        # Hash the input password
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        query = "SELECT email, is_admin FROM [dbo].[app_buyout_users] WHERE email = ? AND password_hash = ?"
        cursor.execute(query, (email, password_hash))
        user = cursor.fetchone()
        if user:
            print(f"✅ Login successful for {email} (Admin: {user[1]})") 
        else:
            print(f"⚠️ Login failed for {email}")
        return user if user else None
    except Exception as e:
        print("❌ Authentication error:", e)
        return None
    finally:
        conn.close()

### USED IN USER BUYOUT PAGE
def get_games():
    conn = pyodbc.connect(AZURE_SQL_CONNECTION_STRING)
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT game FROM [gold].[buyout_products]")
    games = cursor.fetchall()
    conn.close()
    return [{"game": row[0]} for row in games]

def get_editions_by_game(game):
    conn = pyodbc.connect(AZURE_SQL_CONNECTION_STRING)
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT [Edition] FROM [gold].[buyout_products] WHERE Game = ?", (game,))
    editions = cursor.fetchall()
    conn.close()
    return [{"edition": row[0]} for row in editions]

def get_products_by_edition(game, edition):
    conn = pyodbc.connect(AZURE_SQL_CONNECTION_STRING)
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT id, name FROM [gold].[buyout_products] WHERE Game = ? AND Edition = ?", (game, edition))
    products = cursor.fetchall()
    conn.close()
    return [{"id": row[0], "name": row[1]} for row in products]


def get_rarities_by_product(game, edition, product):
    conn = pyodbc.connect(AZURE_SQL_CONNECTION_STRING)
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT Rarity FROM [gold].[buyout_products] WHERE Game = ? AND Edition = ? AND Name = ?", (game, edition, product))
    rarities = cursor.fetchall()
    conn.close()
    return [{"rarity": row[0]} for row in rarities]


def get_reverse_holo(game, edition, product, rarity):
    conn = pyodbc.connect(AZURE_SQL_CONNECTION_STRING)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT isReverseHolo 
        FROM [gold].[buyout_products] 
        WHERE game = ? AND Edition = ? AND Name = ? AND Rarity = ?
    """, (game, edition, product, rarity))
    result = cursor.fetchall()
    conn.close()
    return [{"isReverseHolo": row[0]} for row in result]

def get_price_by_filters(filters):
    conn = pyodbc.connect(AZURE_SQL_CONNECTION_STRING)
    cursor = conn.cursor()
    query = """
        SELECT sell_price as price FROM [gold].[buyout_products] 
        WHERE Game = ? AND Edition = ? AND Name = ? AND Rarity = ?
        AND isReverseHolo = ?
    """
    cursor.execute(query, (
        filters["game"], filters["edition"], filters["product"],
        filters["rarity"], filters["isReverseHolo"]
    ))
    price = cursor.fetchone()
    conn.close()
    return price[0] if price else None

def save_order(email, TradeType, PickupType, PickupPoint, PhoneNumber, FirstName, LastName, City, 
               StreetAddress, PostalCode, Country, items, trade_items=None):
    conn = pyodbc.connect(AZURE_SQL_CONNECTION_STRING)
    cursor = conn.cursor()

    try:
        print("🗃️ Ukladanie údajov:", email, TradeType, PickupType, PickupPoint, PhoneNumber, FirstName, items, trade_items)

        OrderId = datetime.now().strftime('%Y%m%d%H%M%S')

        cursor.execute("""
            INSERT INTO [bronze].[tcg_buyout_orders] (
                OrderId, Email, TradeType, PickupType, PickupPoint, PhoneNumber, FirstName, LastName, 
                City, StreetAddress, PostalCode, Country, IsProcessed, CreatedDate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, GETDATE())
        """, (OrderId, email, TradeType, PickupType, PickupPoint, PhoneNumber, FirstName, LastName, 
              City, StreetAddress, PostalCode, Country))

        # ✅ Vloženie vykupovaných kariet
        for item in items:
            cursor.execute("""
                INSERT INTO [bronze].[tcg_buyout_items] (
                    OrderId, Game, Edition, ProductId, ProductName, condition, 
                    rarity, isReverseHolo, price, Quantity, IsProcessed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            """, (
                OrderId, item.get('game'), item.get('edition'), item.get('productId'),
                item.get('product'), item.get('condition'), item.get('rarity'),
                item.get('isReverseHolo'), item.get('price'), item.get('quantity')
            ))

        # ✅ Inicializácia trade_items ak je None
        trade_items = trade_items or []
        total_trade_amount = 0.0

        # ✅ Vloženie výmenného tovaru (ak TradeType = "Tovar")
        for trade in trade_items:
            product_code = trade.get('product_code', 'UNKNOWN')
            quantity = int(trade.get('quantity', 0))
            amount = float(trade.get('amount', 0))
            
            cursor.execute("""
                INSERT INTO [bronze].[tcg_buyout_trades] (
                    order_id, product_code, quantity, amount, trade_type
                ) VALUES (?, ?, ?, ?, ?)
            """, (
                OrderId,
                product_code,
                quantity,
                amount,
                TradeType
            ))
            total_trade_amount += amount * quantity
        
        # ✅ Výpočet celkových súm a vyrovnávacieho zostatku
        total_buyout_amount = round(sum(float(item.get('price', 0)) * int(item.get('quantity', 0)) for item in items), 2)

        if not trade_items:
            total_trade_amount = 0.0

        balance = round(total_buyout_amount - total_trade_amount, 2)

        print(f"📊 DEBUG: Total Buyout Amount = {total_buyout_amount}")
        print(f"📊 DEBUG: Total Trade Amount = {total_trade_amount}")
        print(f"⚖️ DEBUG: Calculated Balance = {balance}")

        if balance is None:
            balance = 0.0

        # ✅ Ak je TradeType "Tovar" a zostatok nie je nula, pridáme BALANCE_ADJUSTMENT
        if TradeType == "Tovar" and balance != 0:
            cursor.execute("""
                INSERT INTO [bronze].[tcg_buyout_trades] (
                    order_id, product_code, quantity, amount, trade_type
                ) VALUES (?, ?, ?, ?, ?)
            """, (
                OrderId,
                "BALANCE_ADJUSTMENT",
                1,  # Quantity is typically 1 for balance adjustment
                round(balance, 2),
                TradeType
            ))

        conn.commit()
        print("✅ Úspešne uložené.")

        # ✅ GENEROVANIE EMAILU
        subject = "Your Card Buyout Order Confirmation"
        email_body = f"""
        <html>
        <body>
            <p>Dear {FirstName},</p>
            <p>Thank you for submitting your card buyout request. Below is a summary of your order:</p>

            <h3>Cards in Buyout:</h3>
            <table border="1" cellpadding="5" cellspacing="0">
                <tr>
                    <th>Game</th>
                    <th>Edition</th>
                    <th>Card Name</th>
                    <th>Condition</th>
                    <th>Quantity</th>
                    <th>Price per Unit</th>
                    <th>Total</th>
                </tr>
                {''.join(f"<tr><td>{item.get('game')}</td><td>{item.get('edition')}</td><td>{item.get('product')}</td>"
                         f"<td>{item.get('condition')}</td><td>{item.get('quantity')}</td><td>{item.get('price')}</td>"
                         f"<td>{round(float(item.get('price', 0)) * int(item.get('quantity', 0)), 2)}</td></tr>"
                         for item in items)}
            </table>

            <h3>Total Buyout Amount: €{total_buyout_amount:.2f}</h3>
        """

        if TradeType == "Tovar":
            email_body += f"""
            <h3>Requested Trade Items:</h3>
            <table border="1" cellpadding="5" cellspacing="0">
                <tr>
                    <th>Product Name</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Total</th>
                </tr>
                {''.join(f"<tr><td>{trade.get('product')}</td><td>{trade.get('quantity')}</td>"
                         f"<td>{trade.get('amount')}</td><td>{round(trade.get('amount', 0) * trade.get('quantity', 0), 2)}</td></tr>"
                         for trade in trade_items)}
            </table>
            <h3>Total Trade Amount: €{total_trade_amount:.2f}</h3>
            <h3>Balance Adjustment: €{balance:.2f}</h3>
            """

        email_body += """
            <p>If you have any questions, feel free to contact us.</p>
            <p>Best regards,<br>Card Empire Team</p>
        </body>
        </html>
        """

        send_email(email, subject, email_body)
        print(f"📧 Email sent to {email}")

    except Exception as e:
        print(f"❌ Chyba pri ukladaní do databázy: {str(e)}")
        conn.rollback()

    finally:
        conn.close()

# Funkcia na načítanie produktov z [silver].[product]
def get_eshop_products():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT Name, Code, Ean, PriceWithVat 
        FROM [silver].[product]
    """
    cursor.execute(query)
    
    products = []
    for row in cursor.fetchall():
        products.append({
            "name": row[0],  # ✅ Access by index
            "product_code": row[1],  # ✅ Use correct column aliasing
            "ean": row[2],  
            "price": float(row[3])  # ✅ Ensure price is float
        })

    cursor.close()
    conn.close()
    
    return products  # ✅ Returning a regular Python list (not JSON)


### USED IN ADMIN PAGE
def get_unassigned_orders():
    """Fetch unassigned orders (where assignedTo is NULL)."""
    conn = pyodbc.connect(AZURE_SQL_CONNECTION_STRING)
    cursor = conn.cursor()
    cursor.execute("SELECT OrderId, email FROM bronze.tcg_buyout_orders WHERE assignedTo IS NULL")
    orders = cursor.fetchall()
    conn.close()
    return [{"OrderId": row.OrderId, "email": row.email} for row in orders]

def get_assigned_orders(email):
    """Retrieve assigned orders from the database for a given user."""
    conn = pyodbc.connect(AZURE_SQL_CONNECTION_STRING)
    cursor = conn.cursor()

    query = """
        SELECT OrderId, email, IsProcessed
        FROM bronze.tcg_buyout_orders
        WHERE assignedTo = ? AND IsProcessed = 0
    """
    cursor.execute(query, (email,))
    orders = cursor.fetchall()
    order_list = [{"OrderId": row.OrderId, "email": row.email, "processed": row.IsProcessed} for row in orders]
    conn.close()
    return order_list

def post_assign_order_to_user(OrderId, email):
    """Assigns an order to the logged-in admin by updating the database."""
    conn = pyodbc.connect(AZURE_SQL_CONNECTION_STRING)
    cursor = conn.cursor()

    # Check if the order exists and is unassigned
    cursor.execute("SELECT OrderId FROM bronze.tcg_buyout_orders WHERE OrderId = ? AND assignedTo IS NULL", (OrderId,))
    order = cursor.fetchone()

    if not order:
        conn.close()
        return False  # Order does not exist or is already assigned

    # Assign the order to the user
    cursor.execute("UPDATE bronze.tcg_buyout_orders SET assignedTo = ? WHERE OrderId = ?", (email, OrderId))
    conn.commit()
    conn.close()
    return True

def get_order_details(OrderId):
    """Retrieve order details from the database using order ID."""
    conn = pyodbc.connect(AZURE_SQL_CONNECTION_STRING)
    cursor = conn.cursor()

    try:
        query = """
            SELECT 
                [id], [Game], [Edition], [ProductId], [ProductName], [rarity], 
                [isReverseHolo],[condition], [price], [Quantity], [IsAcceptedSingle]
            FROM bronze.tcg_buyout_items
            WHERE OrderId = ?
        """
        
        print(f"Executing query for Order ID: {OrderId}")  # Debugging log
        cursor.execute(query, (OrderId,))
        rows = cursor.fetchall()

        if not rows:
            return []  # ✅ Always return an empty list

        order_details = []
        for row in rows:
            order_details.append({
                "Id": row.id,
                "Game": row.Game,
                "Edition": row.Edition,
                "ProductId": row.ProductId,
                "ProductName": row.ProductName,
                "Rarity": row.rarity,
                "ReverseHolo": bool(row.isReverseHolo),
                "Condition": row.condition,
                "Price": row.price,
                "Quantity": row.Quantity,
                "Accepted": bool(row.IsAcceptedSingle)
            })

        print(f"Order details result: {order_details}")  # Debugging log
        return order_details  # ✅ Always return an array

    except Exception as e:
        print(f"Database error: {str(e)}")  # Debugging log
        return []  # ✅ Return empty list instead of error

    finally:
        conn.close()

 
def post_update_order_items(updates):
    """Update order items and trade products, setting IsAccepted = 0 for unaccepted trades."""
    conn = pyodbc.connect(AZURE_SQL_CONNECTION_STRING)
    cursor = conn.cursor()

    try:
        # Update order items
        item_update_query = """
            UPDATE bronze.tcg_buyout_items 
            SET condition = ?, price = ?, Quantity = ?, IsAcceptedSingle = ?
            WHERE id = ?
        """
        first_item_id = updates[0]["id"]
        cursor.execute("SELECT OrderId FROM bronze.tcg_buyout_items WHERE id = ?", (first_item_id,))
        order_id = cursor.fetchone()[0]

        cursor.executemany(item_update_query, [
            (item["condition"], item["price"], item["quantity"], item["IsAcceptedSingle"], item["id"])
            for item in updates
        ])

        # Update trade products (set IsAccepted = 0 instead of deleting)
        if "trade_updates" in updates[0]:
            trade_update_query = """
                UPDATE bronze.tcg_trade_items 
                SET quantity = ?, IsAccepted = ? 
                WHERE id = ?
            """
            cursor.executemany(trade_update_query, [
                (trade["quantity"], trade["IsAccepted"], trade["id"])
                for trade in updates[0]["trade_updates"]
            ])

        # Update order status based on accepted items
        cursor.execute("""
            SELECT COUNT(*) FROM bronze.tcg_buyout_items WHERE OrderId = ? AND IsAcceptedSingle = 1
        """, (order_id,))
        order_accepted = cursor.fetchone()[0] > 0

        cursor.execute("""
            SELECT COUNT(*) FROM bronze.tcg_trade_items WHERE OrderId = ? AND IsAccepted = 1
        """, (order_id,))
        trade_accepted = cursor.fetchone()[0] > 0

        new_is_accepted = "YES" if (order_accepted or trade_accepted) else "NO"
        cursor.execute("""
            UPDATE bronze.tcg_buyout_orders 
            SET IsAccepted = ?, IsProcessed = 1 
            WHERE OrderId = ?
        """, (new_is_accepted, order_id))

        conn.commit()
        return True

    except Exception as e:
        print(f"❌ Database update error: {str(e)}")
        conn.rollback()
        return False

    finally:
        conn.close()
        print("Database connection closed.")

def get_trade_details(order_id):
    """
    Získa zoznam trade produktov pre danú objednávku.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT t1.id, t1.product_code, t2.name as product_name, t1.quantity, t1.amount, COALESCE(t1.IsAccepted, 1) as IsAccepted
        FROM [bronze].[tcg_buyout_trades] t1
        JOIN [silver].[product] t2 ON t1.product_code = t2.code
        WHERE t1.order_id = ?
    """
    cursor.execute(query, (order_id,))

    trade_items = []
    for row in cursor.fetchall():
        trade_items.append({
            "id": row[0],  # Added id for tracking
            "product_code": row[1],
            "product_name": row[2],
            "quantity": row[3],
            "amount": float(row[4]),
            "IsAccepted": bool(row[5])  # Ensure IsAccepted is returned as a boolean
        })

    cursor.close()
    conn.close()

    return trade_items  # Returns data as a Python list

def post_recalculate_active_trades():
    """Recalculates active trade prices by reducing them by 10% in bronze.tcg_buyout_items."""
    conn = pyodbc.connect(AZURE_SQL_CONNECTION_STRING)
    cursor = conn.cursor()

    # Update prices by multiplying by 0.9
    cursor.execute("""
        UPDATE bronze.tcg_buyout_items 
        SET price = price * 0.9 
        WHERE price IS NOT NULL AND price > 0
    """)
    
    # Commit the changes and close the connection
    conn.commit()
    conn.close()
    
    return True

def get_access_token():
    url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": "https://graph.microsoft.com/.default"
    }

    response = requests.post(url, headers=headers, data=data)
    response_json = response.json()
    
    if "access_token" in response_json:
        return response_json["access_token"]
    else:
        print("❌ Error fetching access token:", response_json)
        return None

def send_email(recipient, subject, body):
    access_token = get_access_token()
    if not access_token:
        return False

    url = "https://graph.microsoft.com/v1.0/users/admin@cardempire.onmicrosoft.com/sendMail"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    email_data = {
        "message": {
            "subject": subject,
            "body": {
                "contentType": "HTML",
                "content": body
            },
            "toRecipients": [
                {
                    "emailAddress": {
                        "address": recipient
                    }
                }
            ]
        }
    }

    response = requests.post(url, headers=headers, data=json.dumps(email_data))
    
    if response.status_code in (200, 202):
        print(f"✅ Email sent successfully to {recipient}!")
        return True

    else:
        print(f"❌ Error sending email: {response.status_code}, {response.text}")
        return False