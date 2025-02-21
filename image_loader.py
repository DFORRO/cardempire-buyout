import requests
import os
import time
from concurrent.futures import ThreadPoolExecutor

# Vytvor priečinok pre obrázky
os.makedirs('static/images/cards/', exist_ok=True)

# API endpoint
API_URL = "https://api.pokemontcg.io/v2/cards"

# Funkcia na stiahnutie obrázka
def download_image(card):
    try:
        image_url = card['images']['small']
        card_id = card['id']
        card_name = card['name']
        file_path = f'static/images/cards/{card_id}.png'

        # Preskoč, ak už obrázok existuje
        if os.path.exists(file_path):
            print(f"⚠️ Obrázok už existuje: {card_id}")
            return

        response = requests.get(image_url)
        if response.status_code == 200:
            with open(file_path, 'wb') as f:
                f.write(response.content)
            print(f"✅ Stiahnutý obrázok pre kartu: {card_id}")
        else:
            print(f"❌ Nepodarilo sa stiahnuť: {card_id}")
    except Exception as e:
        print(f"⚠️ Chyba pri stiahnutí obrázka: {e}")

# Funkcia na získanie všetkých kariet
def fetch_cards():
    page = 1
    page_size = 250  # Maximálne podľa API dokumentácie
    more_pages = True

    with ThreadPoolExecutor(max_workers=10) as executor:
        while more_pages:
            print(f"🔄 Načítavam stranu {page}...")
            response = requests.get(f"{API_URL}?page={page}&pageSize={page_size}")

            if response.status_code == 200:
                data = response.json()
                cards = data.get('data', [])

                if not cards:
                    more_pages = False
                    break

                # Paralelné sťahovanie obrázkov
                executor.map(download_image, cards)

                # Pripravené na ďalšiu stránku
                page += 1
                time.sleep(0.5)  # Prevenčné oneskorenie pre API limity
            else:
                print(f"❌ Chyba pri načítaní API: {response.status_code}")
                more_pages = False

if __name__ == "__main__":
    fetch_cards()
