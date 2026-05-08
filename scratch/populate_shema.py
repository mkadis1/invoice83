import sqlite3

def populate():
    conn = sqlite3.connect("racunovodstvo.db")
    cursor = conn.cursor()
    
    # Clear existing
    cursor.execute("DELETE FROM ajpes_shema")
    
    data = [
        # Bilanca stanja
        ('001', 'SREDSTVA', 'bilanca_stanja', '@002+@032+@053'),
        ('002', 'A. DOLGOROČNA SREDSTVA', 'bilanca_stanja', '@010'),
        ('010', 'II. Opredmetena osnovna sredstva', 'bilanca_stanja', '+040+041-050'),
        ('032', 'B. KRATKOROČNA SREDSTVA', 'bilanca_stanja', '@048+@052'),
        ('048', 'IV. Kratkoročne poslovne terjatve', 'bilanca_stanja', '+120'),
        ('052', 'V. Denarna sredstva', 'bilanca_stanja', '+110'),
        ('053', 'C. KRATKOROČNE AKTIVNE ČASOVNE RAZMEJITVE', 'bilanca_stanja', ''),
        ('055', 'OBVEZNOSTI DO VIROV SREDSTEV', 'bilanca_stanja', '@056+@085'),
        ('056', 'A. PODJETNIKOV KAPITAL', 'bilanca_stanja', '@060b+@070'),
        ('060b', 'III. Pritoki in odtoki denarnih sredstev', 'bilanca_stanja', '+910-911'),
        ('070', 'VI. Podjetnikov dohodek', 'bilanca_stanja', '@182'),
        ('085', 'Č. KRATKOROČNE OBVEZNOSTI', 'bilanca_stanja', '@091'),
        ('091', 'III. Kratkoročne poslovne obveznosti', 'bilanca_stanja', '+220'),
        
        # Izkaz poslovnega izida
        ('110', 'A. ČISTI PRIHODKI OD PRODAJE', 'izkaz_poslovnega_izida', '+760'),
        ('126', 'F. KOSMATI DONOS OD POSLOVANJA', 'izkaz_poslovnega_izida', '@110'),
        ('127', 'G. POSLOVNI ODHODKI', 'izkaz_poslovnega_izida', '@128+@144+@148'),
        ('128', 'I. Stroški blaga, materiala in storitev', 'izkaz_poslovnega_izida', '+400+410+415'),
        ('134', '3. Stroški storitev', 'izkaz_poslovnega_izida', '+410+415'),
        ('144', 'III. Odpisi vrednosti', 'izkaz_poslovnega_izida', '+430'),
        ('148', 'IV. Drugi poslovni odhodki', 'izkaz_poslovnega_izida', '+485'),
        ('151', 'H. DOBIČEK IZ POSLOVANJA', 'izkaz_poslovnega_izida', '@126-@127'),
        ('166', 'K. FINANČNI ODHODKI', 'izkaz_poslovnega_izida', '+740'),
        ('182', 'N. Podjetnikov dohodek', 'izkaz_poslovnega_izida', '@151-@166')
    ]
    
    cursor.executemany("INSERT INTO ajpes_shema (oznaka_aop, naziv, vrsta_izkaza, formula) VALUES (?, ?, ?, ?)", data)
    
    conn.commit()
    conn.close()
    print("ajpes_shema populated successfully.")

if __name__ == "__main__":
    populate()
