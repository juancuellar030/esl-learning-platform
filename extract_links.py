import re
with open('excalidraw/excalidraw-index.html', encoding='utf-8') as f:
    content = f.read()
    links = re.findall(r'(?:href|src)=["\']([^"\\]+)["\\]', content)
    for link in links:
        print(link)
