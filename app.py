from flask import Flask, render_template, request, redirect, url_for, session, jsonify, send_from_directory
from database import (
    authenticate_user,
    get_games,
    get_editions_by_game,
    get_products_by_edition,
    get_rarities_by_product,
    get_price_by_filters,
    get_eshop_products,
    save_order,
    get_reverse_holo,
    get_unassigned_orders,
    get_assigned_orders,
    post_assign_order_to_user,
    get_order_details,
    post_update_order_items,
    get_trade_details,
    post_recalculate_active_trades
)

app = Flask(__name__)
app.secret_key = 'your_secret_key'  # Use a secure key (Consider using an .env file)

# Simulated order storage (replace with a database)
orders = []
#

### LOGIN PAGE
@app.route('/')
def home():
    return redirect(url_for('login'))  # Redirect users to buyout page by default

@app.route('/static/images/cards/<path:filename>')
def serve_card_image(filename):
    return send_from_directory('static/images/cards', filename)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        if 'continue_as_guest' in request.form:
            session['user'] = 'guest'
            return redirect(url_for('buyout'))  # Guests go to buyout page
        else:
            email = request.form['email']
            password = request.form['password']
            
            user = authenticate_user(email, password)  # Fetch user from DB
            
            if user:
                session['user'] = user[0]  # ✅ Fix: Access email by index 0
                session['is_admin'] = user[1]  # ✅ Fix: Access is_admin by index 1
                print(f"✅ Logged in as: {session['user']}, Admin: {session['is_admin']}")
                return redirect(url_for('admin'))  # Redirect to admin panel
            else:
                return render_template('login.html', error="Invalid credentials!")

    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()  # Clear all session data
    return redirect(url_for('login'))

@app.route('/admin')
def admin():
    """Admin page, only accessible for authenticated admins"""
    if 'user' not in session or not session.get('is_admin', False):
        return redirect(url_for('login'))  # Redirect unauthorized users

    email = session['user']

    unassigned_orders = get_unassigned_orders()
    assigned_orders = get_assigned_orders(email)

    return render_template(
        'admin.html',
        user=email,
        unassigned_orders=unassigned_orders,
        assigned_orders=assigned_orders
    )

@app.route('/buyout', methods=['GET', 'POST'])
def buyout():
    """Handles buyout process, allowing guest users."""
    user_email = session.get('user', 'guest')  # Allow guest users

    if request.method == 'POST':
        items = request.json.get('items')
        if not items:
            return jsonify({"error": "No items provided."}), 400

        OrderId = save_order(user_email, items)  # Save order in DB
        return jsonify({"message": "Order submitted successfully!", "OrderId": OrderId})

    return render_template('buyout_form.html', user=user_email)


###GUEST PORTAL
@app.route('/api/games', methods=['GET'])
def api_get_games():
    try:
        games = get_games()
        return jsonify(games)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/editions', methods=['GET'])
def api_get_editions():
    try:
        game = request.args.get('game')
        if not game:
            return jsonify([])
        editions = get_editions_by_game(game)
        return jsonify(editions)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/products', methods=['GET'])
def api_get_products():
    try:
        game = request.args.get('game')
        edition = request.args.get('edition')
        if not game or not edition:
            return jsonify([])
        products = get_products_by_edition(game, edition) 
        return jsonify(products)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/rarities', methods=['GET'])
def get_rarities():
    game = request.args.get('game')
    edition = request.args.get('edition')
    product = request.args.get('product')

    rarities = get_rarities_by_product(game, edition, product)
    return jsonify(rarities)

@app.route('/api/reverse_holo', methods=['GET'])
def api_get_reverse_holo():
    try:
        game = request.args.get('game')
        edition = request.args.get('edition')
        product = request.args.get('product')
        rarity = request.args.get('rarity')

        if not game or not edition or not product or not rarity:
            return jsonify([])

        reverse_holo = get_reverse_holo(game, edition, product, rarity)
        return jsonify(reverse_holo)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/price', methods=['GET'])
def api_get_price_by_filters():
    try:
        filters = {
            "game": request.args.get('game'),
            "edition": request.args.get('edition'),
            "product": request.args.get('product'),
            "rarity": request.args.get('rarity'),
            "isReverseHolo": request.args.get('isReverseHolo')
        }
        price = get_price_by_filters(filters)
        return jsonify({"price": price})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/submit_order', methods=['POST'])
def submit_order():
    try:
        data = request.json
        print("📥 Prijaté údaje:", data)  # Debugging log

        email = data.get('email')
        TradeType = data.get('TradeType')
        PickupType = data.get('PickupType')
        PickupPoint = data.get('PickupPoint')
        PhoneNumber = data.get('PhoneNumber')
        FirstName = data.get('FirstName')
        LastName = data.get('LastName')
        City = data.get('City')
        StreetAddress = data.get('StreetAddress')
        PostalCode = data.get('PostalCode')
        Country = data.get('Country')
        items = data.get('items')
        tradeItems = data.get('tradeItems', [])  # Default to empty list if not provided

        if not email or not items:
            return jsonify({"error": "Invalid data. Email and items are required."}), 400

        print("💾 Ukladám objednávku...")

        save_order(email, TradeType, PickupType, PickupPoint, PhoneNumber, FirstName, LastName, City, 
                   StreetAddress, PostalCode, Country, items, tradeItems)

        return jsonify({"message": "Order submitted successfully!"})

    except Exception as e:
        print(f"❌ Chyba: {str(e)}")  # Add detailed error output
        return jsonify({"error": str(e)}), 500

 # API endpoint na získanie produktov
@app.route('/api/eshop_products', methods=['GET'])
def fetch_products():
    products = get_eshop_products()
    return jsonify(products)

if __name__ == '__main__':
    app.run(debug=True)

###ADMIN PORTAL
@app.route('/api/order_details', methods=['GET'])
def api_get_order_details():
    """Fetch order details based on orderId from the database."""
    OrderId = request.args.get('OrderId')

    if not OrderId:
        return jsonify({"error": "Order ID is required"}), 400

    try:
        order_details = get_order_details(OrderId)

        if not order_details:
            return jsonify({"order_details": []})  # ✅ Ensure expected format

        return jsonify({"order_details": order_details})  # ✅ Wrap array in an object

    except Exception as e:
        print(f"Error fetching order details: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/assign_order_to_user', methods=['POST'])
def api_post_assign_order_to_user():
    """Assigns an unassigned order to the logged-in admin."""
    if 'user' not in session or session['user'] == 'guest':
        return jsonify({"message": "Unauthorized access", "success": False}), 403

    email = session['user']
    data = request.json
    OrderId = data.get('OrderId')

    if not OrderId:
        return jsonify({"message": "Invalid order ID", "success": False}), 400

    # Call function from database.py
    success = post_assign_order_to_user(OrderId, email)

    if success:
        return jsonify({"message": f"Order #{OrderId} assigned to {email}", "success": True})
    else:
        return jsonify({"message": "Order not found or already assigned", "success": False}), 404

@app.route('/api/assigned_orders', methods=['GET'])
def api_get_assigned_orders():
    """Retrieve assigned orders for the logged-in user."""
    if 'user' not in session or session['user'] == 'guest':
        return jsonify({"message": "Unauthorized access", "success": False}), 403

    email = session['user']
    orders = get_assigned_orders(email)
    return jsonify({"orders": orders})

@app.route('/modify_order/<OrderId>', methods=['GET', 'POST'])
def modify_order(OrderId):
    if 'user' not in session or session['user'] == 'guest':
        return redirect(url_for('login'))  # Restrict access for guests

    order = next((o for o in orders if str(o["id"]) == OrderId), None)

    if not order:
        return "Order not found", 404  # Handle non-existent order

    if request.method == 'POST':
        modified_items = request.json.get('items', [])
        order["items"] = modified_items  # Update order details
        order["processed"] = True  # Mark as processed
        return jsonify({"message": "Order updated successfully!", "redirect": url_for('admin')})
    return render_template('modify_order.html', order=order)

@app.route('/api/update_order_items', methods=['POST'])
def api_post_update_order_items():
    """Update multiple fields in order items based on user input."""
    try:
        data = request.json
        print(f"📥 Received Payload: {data}")  # Log received data

        if not data or "items" not in data:
            print("❌ ERROR: 'items' missing from request")
            return jsonify({"success": False, "message": "Invalid request data: 'items' missing"}), 400

        items = data["items"]

        if not isinstance(items, list) or len(items) == 0:
            print("❌ ERROR: 'items' is not a valid non-empty list")
            return jsonify({"success": False, "message": "Invalid request data: 'items' must be a non-empty list"}), 400

        # Allowed fields
        allowed_fields = {"Condition": "condition", "Price": "price", "Quantity": "Quantity", "IsAcceptedSingle": "IsAcceptedSingle"}

        updates = []
        for item in items:
            if not all(k in item for k in ["id", "condition", "price", "quantity", "IsAcceptedSingle"]):
                print(f"❌ ERROR: Missing required fields in item: {item}")
                return jsonify({"success": False, "message": "Missing required fields"}), 400

            Id = item["id"]
            condition = item["condition"]
            price = float(item["price"])
            quantity = int(item["quantity"])
            IsAcceptedSingle = bool(item["IsAcceptedSingle"])

            updates.append({"id": Id, "condition": condition, "price": price, "quantity": quantity, "IsAcceptedSingle": IsAcceptedSingle})

        print(f"🛠 Preparing to update items: {updates}")  # Log prepared updates

        # Perform batch update
        success = post_update_order_items(updates)

        print(f"✅ Database Update Status: {success}")  # Log if update was successful

        if success:
            print("✅ Order items updated successfully!")
            return jsonify({"success": True, "message": "Order items updated successfully!"})
        else:
            print("❌ ERROR: Update failed in database")
            return jsonify({"success": False, "message": "Failed to update order items"}), 500

    except Exception as e:
        print(f"❌ Exception occurred: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/trade_details', methods=['GET'])
def trade_details():
    """
    Endpoint na získanie trade produktov pre konkrétnu objednávku.
    """
    order_id = request.args.get('OrderId')
    
    if not order_id:
        return jsonify({"error": "Order ID is required"}), 400

    try:
        trade_items = get_trade_details(order_id)
        return jsonify(trade_items)  # Returns IsAccepted as boolean (True/False or 1/0)
    except Exception as e:
        print(f"❌ Chyba pri načítaní trade produktov: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/recalculate_active_trades', methods=['POST'])
def recalculate_active_trades():
    try:
        success = post_recalculate_active_trades()
        if success:
            return jsonify({
                "success": True,
                "message": "Successfully recalculated active trade prices."
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": "Failed to recalculate active trade prices."
            }), 400
    except Exception as e:
        print(f"❌ Error recalculating active trades: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"Error recalculating active trades: {str(e)}"
        }), 500