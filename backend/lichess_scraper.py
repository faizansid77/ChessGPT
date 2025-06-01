import requests
from bs4 import BeautifulSoup
import json
import time

BASE_URL = "https://lichess.org/study/all/popular?page={}"
PGN_EXPORT_URL = "https://lichess.org/api/study/{}.pgn"
NUM_PAGES_TO_SCRAPE = 13 # Approx 200 studies if ~16 per page, aiming for ~200
TARGET_STUDY_COUNT = 200
OUTPUT_FILE = "data/lichess_studies_2.json"

def fetch_page(page_number):
    """Fetches the content of a Lichess studies page."""
    url = BASE_URL.format(page_number)
    print(f"Fetching {url}...")
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        print(f"Error fetching page {page_number} ({url}): {e}")
        return None

def fetch_study_pgn(study_id):
    """Fetches the PGN content for a given study_id."""
    url = PGN_EXPORT_URL.format(study_id)
    print(f"Fetching PGN for study {study_id} from {url}...")
    try:
        response = requests.get(url, timeout=20) # PGNs can be larger
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        print(f"Error fetching PGN for study {study_id} ({url}): {e}")
        return None

def parse_studies(html_content):
    """Parses study information from HTML content based on observed structure."""
    studies_on_page = []
    soup = BeautifulSoup(html_content, 'html.parser')

    # Each study is wrapped in a <div class="study paginated">
    study_divs = soup.find_all('div', class_='study paginated')

    if not study_divs:
        print("No study divs with class 'study paginated' found. HTML structure might have changed.")
        # print(html_content[:2000]) # For debugging raw HTML
        return studies_on_page

    for study_div in study_divs:
        study_id, title, study_url, author_str, likes_str = None, "N/A", "N/A", "N/A", "N/A"

        # Link and Title from <a class="overlay"> tag
        overlay_link_tag = study_div.find('a', class_='overlay')
        if overlay_link_tag and overlay_link_tag.has_attr('href') and overlay_link_tag.has_attr('title'):
            raw_link = overlay_link_tag['href']
            title = overlay_link_tag['title'].strip()
            if raw_link.startswith('/study/'):
                parts = raw_link.split('/')
                if len(parts) > 2:
                    study_id = parts[2] # The part after /study/
                    study_url = "https://lichess.org" + raw_link
        
        if not study_id: # If overlay link didn't yield ID, skip this entry
            # print(f"Could not extract study_id from overlay_link for a study div. Title: {title}")
            continue

        # Likes and Primary Author from <div class="top"> span
        top_div = study_div.find('div', class_='top')
        if top_div:
            # Title can also be found here if needed: h2_name = top_div.find('h2', class_='study-name')
            info_span = top_div.find('span') # The span containing likes and primary author
            if info_span:
                likes_icon = info_span.find('i', attrs={'data-icon': ''}) # Heart icon for likes
                if likes_icon and likes_icon.next_sibling:
                    likes_text_node = likes_icon.next_sibling
                    if likes_text_node and isinstance(likes_text_node, str):
                        likes_str = likes_text_node.strip().split('•')[0].strip()
                
                # Extract primary author from the same span
                span_texts = [text.strip() for text in info_span.stripped_strings]
                if len(span_texts) > 1:
                    # Example: ['40179', '•', 'Toxenory', '•'] or ['40179', '•', 'Toxenory']
                    # Find the author name, usually after the first '•'
                    try:
                        author_index = span_texts.index('•', 1) + 1 # find second '•' if present, or first for author
                        if author_index < len(span_texts) and span_texts[author_index] != '•':
                           # primary_author = span_texts[author_index]
                           pass # We will get all authors from .members list anyway
                    except ValueError: # If only one '•' (likes • author)
                        if len(span_texts) > 2 and span_texts[1] == '•':
                            # primary_author = span_texts[2]
                            pass # We will get all authors from .members list anyway
        
        # All Authors from <div class="body"> <ol class="members">
        body_div = study_div.find('div', class_='body')
        authors_found = []
        if body_div:
            members_ol = body_div.find('ol', class_='members')
            if members_ol:
                member_lis = members_ol.find_all('li', class_='text')
                for li in member_lis:
                    author_name = li.get_text(strip=True)
                    if author_name:
                        authors_found.append(author_name)
        
        author_str = ", ".join(sorted(list(set(authors_found)))) if authors_found else "N/A"

        studies_on_page.append({
            'study_id': study_id,
            'title': title,
            'url': study_url,
            'author': author_str,
            'likes': likes_str, # Store as string, can be parsed to int later if needed
            'pgn': None # Placeholder for PGN content
        })

    return studies_on_page

def main():
    all_studies_data = []
    print(f"Fetching Lichess studies, aiming for ~{TARGET_STUDY_COUNT} studies from up to {NUM_PAGES_TO_SCRAPE} pages...")

    for page_num in range(1, NUM_PAGES_TO_SCRAPE + 1):
        if len(all_studies_data) >= TARGET_STUDY_COUNT:
            print(f"Reached target of {TARGET_STUDY_COUNT} studies. Stopping page scraping.")
            break

        html = fetch_page(page_num)
        if html:
            studies_on_this_page = parse_studies(html)
            if not studies_on_this_page and page_num == 1:
                print("Warning: No studies found on the first page. Check HTML structure and selectors.")
                break
            elif not studies_on_this_page:
                print(f"No more studies found on page {page_num}. Stopping.")
                break
            
            print(f"Found {len(studies_on_this_page)} potential studies on page {page_num}.")
            
            for study_info in studies_on_this_page:
                if len(all_studies_data) >= TARGET_STUDY_COUNT:
                    break
                pgn_content = fetch_study_pgn(study_info['study_id'])
                if pgn_content:
                    study_info['pgn'] = pgn_content
                    all_studies_data.append(study_info)
                    print(f"Successfully fetched PGN for study: {study_info['title'][:50]}... ({len(all_studies_data)}/{TARGET_STUDY_COUNT}) ")
                else:
                    print(f"Skipping study {study_info['study_id']} due to PGN fetch error.")
                time.sleep(0.5) # Be respectful to Lichess servers
        else:
            print(f"Failed to fetch page {page_num}, stopping.")
            break
        
        if page_num < NUM_PAGES_TO_SCRAPE and len(all_studies_data) < TARGET_STUDY_COUNT:
            time.sleep(1) # Wait a bit before fetching the next page of studies

    print(f"\nTotal studies with PGNs scraped: {len(all_studies_data)}")

    if all_studies_data:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(all_studies_data, f, indent=4, ensure_ascii=False)
        print(f"Successfully saved {len(all_studies_data)} studies to {OUTPUT_FILE}")
    else:
        print("No studies were scraped and saved.")

if __name__ == "__main__":
    main()
