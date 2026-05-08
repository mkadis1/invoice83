import pdfplumber

def extract():
    with pdfplumber.open('Bilanca/DDD_DDD_EDP-11648236-140.pdf') as pdf:
        full_text = ""
        for page in pdf.pages:
            full_text += page.extract_text() + "\n"
            
    with open('scratch/bilanca_text.txt', 'w', encoding='utf-8') as f:
        f.write(full_text)

if __name__ == "__main__":
    extract()
