# Produit a5-demeure.html (retours du proprietaire 26/10/2026) a partir de a4-demeure.html.
import re, pathlib
HERE = pathlib.Path(__file__).resolve().parent
D = HERE.parent / 'docs/maquettes/2026-10-22_haute-classe'
h = (D / 'a4-demeure.html').read_text(encoding='utf-8')


def rep(old, new):
    global h
    assert h.count(old) >= 1, 'introuvable: ' + old[:70]
    h = h.replace(old, new, 1)


# --- textes ---
rep('<title>Domaine La Rosière — A4 « Demeure »</title>', '<title>DOMAINE LA ROSIÈRE - ALSACE</title>')
rep('<a class="mark" href="#"><b>La Rosière</b><small>Domaine · Alsace</small></a>',
    '<a class="mark" href="#"><b>Domaine La Rosière</b><small>Alsace</small></a>')
rep('<h1><span>Le plaisir d’être ensemble,</span><em>toute l’année.</em></h1>',
    '<h1><span>Le plaisir d’être ensemble...</span></h1>')
rep('Une demeure de 1947 louée entière à votre groupe, jusqu’à cinquante personnes, avec sa piscine intérieure chauffée et quatre mille mètres carrés de jardins.',
    'Bienvenue au Domaine La Rosière, une grande demeure de caractère entièrement privatisée pour votre groupe jusqu\'à 50 personnes, avec piscine intérieure chauffée et 4 000 m² de jardins.')
rep('Au sous-sol de la villa, un bassin', 'À l’entre-sol de la villa, un bassin')
rep('<h2 class="h2">La Rosière, depuis 1947.</h2>', '<h2 class="h2">La Rosière, depuis 2014.</h2>')
rep('<p class="muted">Une grande maison de famille au cœur des Vosges du Nord, louée entière à votre groupe : un lobby de soixante-dix mètres carrés, des salons ouverts sur le jardin et, au sous-sol, la piscine.</p>',
    '<p class="muted">Le Domaine La Rosière, vous accueille depuis 2014.<br>Une grande maison de famille au cœur des Vosges du Nord, louée en totalité à votre groupe : un lobby de soixante-dix mètres carrés, des salons ouverts sur le jardin et, au sous-sol, la piscine.</p>')

# --- chambres : photos par etage ---
m = re.search(r'<div class="rooms__pics">.*?</div>\n    <div>\n      <div class="floors"', h, re.S)
assert m
h = h.replace(m.group(0), '<div class="rooms__pics" data-roompics aria-live="polite"></div>\n    <div>\n      <div class="floors"')
rep('<p class="muted">Choisissez un étage pour voir chaque chambre, ses lits et sa salle d’eau.</p>',
    '<p class="muted">Choisissez un étage : les photos et le détail des chambres changent avec lui.</p>')

# --- acces : Google Maps ---
m = re.search(r'    <figure>\n      <svg class="map".*?</figure>\n', h, re.S)
assert m
route = (HERE / 'a5-route.html').read_text(encoding='utf-8')
h = h.replace(m.group(0), route)

# --- formulaire ---
rep('<label class="fld c2 tel"><span>Téléphone, facultatif</span><input type="tel" name="phone" autocomplete="tel"></label>',
    '<label class="fld c2 tel"><span>Téléphone</span><input type="tel" name="phone" autocomplete="tel" required></label>')
rep('<label class="fld c6"><span>Message, facultatif</span>',
    '<div class="fld c6"><span>Options</span><div class="chips"><label><input type="checkbox" name="sheets"><span>Draps · 10 € / pers.</span></label><label><input type="checkbox" name="towels"><span>Serviettes · 3 € / pers.</span></label></div></div>\n          <label class="fld c6"><span>Message</span>')
rep('<textarea name="message" rows="2" placeholder="Vos questions, vos besoins particuliers…"></textarea>',
    '<textarea name="message" rows="2" required placeholder="Présentez votre groupe, vos questions, vos besoins particuliers…"></textarea>')
rep('<div class="card__head"><h3>Votre demande</h3><span>Réponse personnelle du propriétaire</span></div>',
    '<div class="card__head"><h3>Votre demande</h3><span>Réponse personnelle du propriétaire</span></div>\n'
    '        <div class="cal" data-cal aria-label="Disponibilités"><div class="cal__nav"><button type="button" data-calnav="-1" aria-label="Mois précédent">‹</button><b data-calttl></b><button type="button" data-calnav="1" aria-label="Mois suivant">›</button></div><div class="cal__months" data-calm></div><ul class="cal__key"><li><i class="k-free"></i>Libre</li><li><i class="k-busy"></i>Déjà réservé</li><li><i class="k-sel"></i>Votre séjour</li></ul></div>')
rep('<button class="send" type="submit">Envoyer ma demande</button>\n        </div>',
    '<button class="send" type="submit">Envoyer ma demande</button>\n        </div>\n        <p class="estim" data-estim aria-live="polite" hidden></p>')
rep('<h3>Merci, votre demande est prête.</h3>\n        <p>Maquette : l’envoi est simulé, rien n’est parti.</p>',
    '<h3 data-donetitle>Merci, votre demande est envoyée.</h3>\n        <p data-donetxt>Le propriétaire vous répond personnellement.</p>')

# --- pied de page ---
rep('<div><h4>Adresse</h4><address>116 Grand’Rue<br>67430 Diemeringen</address></div>',
    '<div><h4>Adresse</h4><address>116 Grand’Rue<br>67430 Diemeringen<br><a href="tel:+33771712015">07 71 71 20 15</a><br><a href="mailto:domainelarosiere@gmail.com">domainelarosiere@gmail.com</a></address></div>')
rep('<b>La Rosière</b><small>Domaine · Diemeringen · Alsace</small>', '<b>Domaine La Rosière</b><small>Diemeringen · Alsace</small>')

# --- CSS ---
rep('</style>', (HERE / 'a5.css').read_text(encoding='utf-8') + '</style>')

# --- JS : le bloc "demande (maquette ...)" est remplace par la version complete ---
i = h.index('  // demande (maquette : envoi simule)')
j = h.index("  document.querySelector('[data-totop]')")
h = h[:i] + (HERE / 'a5-form.js').read_text(encoding='utf-8') + '\n' + h[j:]

# --- etages : photos qui suivent l'onglet ---
rep('  // visionneuse (un jeu de photos', (HERE / 'a5-floors.js').read_text(encoding='utf-8') + '\n  // visionneuse (un jeu de photos')
rep('<li>Vous envoyez vos dates et votre groupe.</li>\n        <li>Le propriétaire répond avec la disponibilité et le tarif.</li>\n        <li>Vous confirmez ; le contrat et un acompte de 30 % finalisent la réservation.</li>',
    '<li>Choisissez vos dates libres dans le calendrier : le montant du séjour s’affiche aussitôt.</li>\n        <li>Votre demande arrive directement chez le propriétaire, qui vous répond.</li>\n        <li>Un acompte de 30 %, par virement ou par carte bancaire, et le contrat finalisent la réservation.</li>')
rep('<p>Vous écrivez directement au propriétaire, sans intermédiaire ni frais de plateforme.</p>',
    '<p>Vous écrivez directement au propriétaire, sans intermédiaire ni frais de plateforme.</p>\n      <p class="ask__tel">Une question ? <a href="tel:+33771712015">07 71 71 20 15</a> · <a href="mailto:domainelarosiere@gmail.com">domainelarosiere@gmail.com</a></p>')
(D / 'a5-demeure.html').write_text(h, encoding='utf-8')

# --- le site publie : FR a la racine, DE dans de/ ---
from a5_de import DE
SITE = 'https://showf68.github.io/domaine-la-rosiere/'
HEAD = ('<meta name="description" content="Domaine La Rosière, à Diemeringen en Alsace : grande demeure privatisée pour les groupes jusqu’à 50 personnes, piscine intérieure chauffée, 15 chambres, 4 000 m² de jardins. Calendrier des disponibilités et réservation directe.">\n'
        f'<link rel="alternate" hreflang="fr" href="{SITE}">\n<link rel="alternate" hreflang="de" href="{SITE}de/">\n'
        f'<meta property="og:title" content="Domaine La Rosière - Alsace">\n<meta property="og:image" content="{SITE}assets/img/piscine.webp">')


def site(lang):
    s = h.replace('<meta name="robots" content="noindex, nofollow">', '<meta name="robots" content="noindex, nofollow">\n' + HEAD)
    s = s.replace('../../assets/', ('' if lang == 'fr' else '../') + 'assets/')
    fr, de = ('./', 'de/') if lang == 'fr' else ('../', './')
    cf, cd = (' aria-current="true"', '') if lang == 'fr' else ('', ' aria-current="true"')
    s = s.replace('<a href="#" aria-current="true">FR</a><a href="#">DE</a>', f'<a href="{fr}"{cf}>FR</a><a href="{de}"{cd}>DE</a>')
    s = s.replace('<a href="#" aria-current="true">Français</a><a href="#">Deutsch</a>', f'<a href="{fr}"{cf}>Français</a><a href="{de}"{cd}>Deutsch</a>')
    if lang == 'de':
        s0 = s
        for a, b in DE:
            assert a in s0, 'DE introuvable: ' + a[:80]
            s = s.replace(a, b)
    return s


out = HERE.parent / 'docs'
(out / 'index.html').write_text(site('fr'), encoding='utf-8')
(out / 'de').mkdir(exist_ok=True)
(out / 'de/index.html').write_text(site('de'), encoding='utf-8')
print('ok : maquette a5, docs/index.html, docs/de/index.html')
