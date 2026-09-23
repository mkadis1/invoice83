from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import date, datetime

class LlamaSettings(BaseModel):
    learning_mode: bool

class Partner(BaseModel):
    id: Optional[int] = None
    naziv: str
    ulica: Optional[str] = None
    postna_stevilka: Optional[str] = None
    kraj: Optional[str] = None
    drzava: Optional[str] = None
    davcna_stevilka: Optional[str] = None
    zavezanec_za_ddv: Optional[bool] = False
    trr: Optional[str] = None
    telefon: Optional[str] = None
    email: Optional[str] = None
    vrsta: Optional[str] = "oba"
    # CRM polja
    status: Optional[str] = "Stranka"
    kategorija: Optional[str] = None
    vir_stranke: Optional[str] = None
    opombe: Optional[str] = None

class PartnerKontakt(BaseModel):
    id: Optional[int] = None
    partner_id: int
    ime_priimek: str
    oddelek: Optional[str] = None
    funkcija: Optional[str] = None
    email: Optional[str] = None
    telefon: Optional[str] = None
    primarni: Optional[bool] = False

class PartnerInterakcija(BaseModel):
    id: Optional[int] = None
    partner_id: int
    datum: Optional[str] = None
    tip: str # 'Klic', 'Sestanek', 'Email', 'Opomba'
    vsebina: Optional[str] = None
    naslednji_korak: Optional[str] = None

class PartnerOpravilo(BaseModel):
    id: Optional[int] = None
    partner_id: int
    naslov: str
    opis: Optional[str] = None
    rok: Optional[str] = None
    status: Optional[str] = "Čaka"
    prioriteta: Optional[str] = "Srednja"

class Nastavitve(BaseModel):
    naziv: Optional[str] = ""
    ulica: Optional[str] = ""
    posta_kraj: Optional[str] = ""
    drzava: Optional[str] = "Slovenija"
    davcna_stevilka: Optional[str] = ""
    zavezanec_za_ddv: Optional[bool] = False
    trr: Optional[str] = ""
    banka: Optional[str] = ""
    email_posiljatelja: Optional[str] = "sim@83.si"
    telefon: Optional[str] = ""
    spletna_stran: Optional[str] = ""
    kratko_ime: Optional[str] = ""
    dvostavno_knjigovodstvo: Optional[bool] = False
    smtp_server: Optional[str] = ""
    smtp_port: Optional[int] = 587
    smtp_username: Optional[str] = ""
    smtp_password: Optional[str] = ""
    smtp_use_tls: Optional[bool] = True
    email_template_racun: Optional[str] = ""
    email_template_ponudba: Optional[str] = ""
    email_template_dobropis: Optional[str] = ""
    email_template_opomin: Optional[str] = ""
    dashboard_config: Optional[str] = None

class PlaciloPovezava(BaseModel):
    dokument_id: int
    znesek: float

class LikvidacijaRequest(BaseModel):
    izpisek_postavka_id: int
    povezave: List[PlaciloPovezava]

class ManualnaLikvidacijaRequest(BaseModel):
    izpisek_postavka_id: int
    manualna: bool

class EmailRequest(BaseModel):
    priloge_ids: List[int] = []
    to_email: Optional[str] = None

class Konto(BaseModel):
    id: Optional[int] = None
    stevilka: str
    naziv: str
    opis: Optional[str] = ""

class ArtiklStoritev(BaseModel):
    id: Optional[int] = None
    sifra: Optional[str] = None
    vrsta: str = "storitev"   # 'artikel' ali 'storitev'
    naziv: str
    opis: Optional[str] = ""
    enota_mere: Optional[str] = "kos"
    cena_malo: Optional[float] = 0.0
    cena_velo: Optional[float] = 0.0
    stopnja_ddv: Optional[float] = 22.0
    konto: Optional[str] = ""
    aktiven: Optional[bool] = True
    vodi_zalogo: Optional[bool] = False
    zacetna_zaloga: Optional[float] = 0.0

class ZakljucnoBesedilo(BaseModel):
    id: Optional[int] = None
    naziv: str
    besedilo: str

class DokumentPostavka(BaseModel):
    artikel_id: Optional[int] = None
    opis: str
    kolicina: float
    cena_enote: float
    stopnja_ddv: float = 22
    znesek_skupaj: float
    konto: Optional[str] = None
    popust: float = 0.0
    enota_mere: Optional[str] = 'kos'

class Dokument(BaseModel):
    id: Optional[int] = None
    poslovno_leto: int
    tip: str
    stevilka: Optional[str] = ""
    partner_id: int
    datum_izdaje: str
    datum_zapadlosti: str
    znesek_brez_ddv: float
    znesek_ddv: float
    znesek_skupaj: float
    datum_storitve_od: Optional[str] = ""
    datum_storitve_do: Optional[str] = ""
    status: Optional[str] = "neplačano"
    datum_placila: Optional[str] = ""
    nacin_placila: Optional[str] = ""
    zakljucno_besedilo: Optional[str] = ""
    noga_dokumenta: Optional[str] = ""
    opombe: Optional[str] = ""
    interna_stevilka: Optional[str] = ""
    valuta: Optional[str] = "EUR"
    tecaj: Optional[float] = 1.0
    znesek_v_valuti: Optional[float] = 0.0
    vkljuci_placilo: Optional[bool] = True
    odstotek_placila: Optional[float] = 100.0
    sklic: Optional[str] = ""
    kompenzacija_doc_id: Optional[int] = None
    delno_placano_znesek: Optional[float] = 0.0
    delna_placila: Optional[str] = "[]"
    stotinska_izravnava: Optional[float] = 0.0
    # K3 — ZDDV-1, čl. 76a: Samoobdavčitev (reverse charge) za tuje storitve
    samoobdavcitev: Optional[bool] = False
    stopnja_ddv_samo: Optional[float] = 22.0
    postavke: List[DokumentPostavka]

class KnjiziRequest(BaseModel):
    temeljnica_id: Optional[int] = None
    novi_naziv: Optional[str] = None
    ids: Optional[List[int]] = None

class BulkKnjizenjeRequest(BaseModel):
    ids: List[int]
    akcija: str # 'knjizi' ali 'razknjizi'
    module: Optional[str] = None # 'place', 'dokumenti', itd.
    temeljnica_id: Optional[int] = None
    novi_naziv: Optional[str] = None

class TemeljnicaPostavkaIn(BaseModel):
    konto: str
    partner_id: Optional[int] = None
    opis: Optional[str] = ""
    datum_zapadlosti: Optional[str] = None
    znesek_v_breme: float = 0.0
    znesek_v_dobro: float = 0.0

class TemeljnicaIn(BaseModel):
    poslovno_leto: int
    vrsta: str
    stevilka: str
    datum: str
    opis: Optional[str] = ""
    postavke: List[TemeljnicaPostavkaIn]

class IzpisekPostavka(BaseModel):
    id: Optional[int] = None
    tip_prometa: str
    partner_id: Optional[int] = None
    namen: str
    znesek: float
    koda_namena: Optional[str] = ""
    konto: Optional[str] = ""
    manualna_likvidacija: bool = False

class Izpisek(BaseModel):
    id: Optional[int] = None
    datum: str
    stevilka_izpiska: str
    zacetno_stanje: float
    koncno_stanje: float
    kontrolna_vsota: float
    postavke: List[IzpisekPostavka]

class Placa(BaseModel):
    id: Optional[int] = None
    zaposleni_id: int
    mesec: str
    leto: int
    vrsta_zaposlitve: str # sp_100 (100%), sp_50 (50%), zaposlen
    bruto_placa: float
    neto_izplacilo: float = 0.0
    znesek_piz: float = 0.0
    znesek_zz: float = 0.0
    znesek_zap: float = 0.0
    znesek_starsevsko: float = 0.0
    znesek_ozp: float = 35.0
    znesek_do: float = 0.0
    znesek_akontacija_doh: float = 0.0
    potni_stroski: float = 0.0
    malica: float = 0.0
    st_malic: Optional[int] = None
    cena_malice: Optional[float] = 7.96
    st_dni_pot: Optional[int] = None
    km_enosmerno: Optional[float] = None
    cena_km: Optional[float] = 0.21
    znesek_skupaj: float = 0.0
    sklic: Optional[str] = ""
    zapadlost: Optional[str] = ""
    konto_prispevkov: Optional[str] = None
    placan: bool = False

class OsnovnoSredstvo(BaseModel):
    id: Optional[int] = None
    naziv: str
    aktiven: Optional[bool] = True
    amortizacijska_skupina: Optional[str] = ""
    inventarna_stevilka: str
    datum_nabave: str
    nabavna_vrednost: float
    stopnja_amortizacije: float
    trenutna_vrednost: Optional[float] = 0.0
    tip: Optional[str] = "OS"

class Zaposleni(BaseModel):
    id: Optional[int] = None
    ime_priimek: str
    naslov: Optional[str] = None
    davcna_stevilka: Optional[str] = None
    iban: Optional[str] = None
    delovno_mesto: Optional[str] = None
    datum_rojstva: Optional[str] = None
    stevilo_otrok: Optional[int] = 0
    invalid_ali_nega: Optional[bool] = False
    delovna_doba_leta: Optional[int] = 0
    dopust_odmerjen: Optional[int] = 20
    dopust_rocni_popravek: Optional[int] = 0
    posta_kraj: Optional[str] = None
    razdalja_do_podjetja: Optional[float] = 0.0

class PotniNalog(BaseModel):
    id: Optional[int] = None
    stevilka_naloga: str
    zaposleni_id: int
    vozilo: Optional[str] = None
    namen: Optional[str] = None
    datum_izdaje: Optional[str] = None
    datum_cas_odhoda: Optional[str] = None
    datum_cas_povratka: Optional[str] = None
    relacija_zacetek: Optional[str] = None
    relacija_cilj: Optional[str] = None
    relacija_konec: Optional[str] = None
    razdalja_km: Optional[float] = 0.0
    znesek_kilometrine: Optional[float] = 0.0
    znesek_dnevnice: Optional[float] = 0.0
    skupni_znesek: Optional[float] = 0.0
