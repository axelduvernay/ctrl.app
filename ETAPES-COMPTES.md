# ctrl.app : activer les comptes et la synchronisation

À faire une seule fois, dans l’ordre. Étapes 1 à 4 : 5 minutes, et les comptes marchent. Étapes 5 et 6 : avant le jury. Le code est prêt et
en ligne. Les noms des menus Supabase peuvent changer un peu : les liens
directs ci-dessous mènent à la bonne page de ton projet (`hsxsgszdzcupguuhgzlb`).
Si quelque chose ne correspond pas, envoie une capture à Claude.

## Étape 1 · Créer la base (2 minutes)

1. Ouvre le **SQL Editor** :
   <https://supabase.com/dashboard/project/hsxsgszdzcupguuhgzlb/sql/new>
   (menu de gauche → icône « SQL Editor » → « New query »).
2. Ouvre le fichier `supabase/schema.sql` du repo ctrl.app sur GitHub
   (<https://github.com/axelduvernay/ctrl.app/blob/main/supabase/schema.sql>),
   bouton « Copy raw file », colle **tout** dans l’éditeur.
3. Clique **Run**. Tu dois voir « Success. No rows returned ».

Ça crée la table des données, l’espace privé pour les sons et les images, et
les règles qui font que chaque compte ne voit que ses propres données.

## Étape 2 · Régler les adresses (1 minute)

<https://supabase.com/dashboard/project/hsxsgszdzcupguuhgzlb/auth/url-configuration>
(Authentication → **URL Configuration**) :

- **Site URL** : `https://axelduvernay.github.io/ctrl.app/`
- **Redirect URLs** → « Add URL », ajoute les deux :
  - `https://axelduvernay.github.io/ctrl.app/`
  - `http://localhost:5173/ctrl.app/`
- Save.

Sans ça, le lien du mail ouvre la mauvaise adresse.

## Étape 3 · Vérifier le fournisseur Email (30 secondes)

<https://supabase.com/dashboard/project/hsxsgszdzcupguuhgzlb/auth/providers>
(Authentication → **Sign In / Providers** → **Email**) :

- « Enable Email provider » : activé.
- « Email OTP Length » : **6**. Save.
- Laisse « Allow new users to sign up » activé (au stand, chaque visiteur peut
  créer son compte).

## Étape 4 · Essayer (avec le lien du mail)

Sans SMTP, le mail de Supabase ne contient qu’un lien. Ça suffit :

1. Ouvre <https://axelduvernay.github.io/ctrl.app/> et recharge (⌘⇧R).
2. Réglages → **Compte et synchronisation** → ton adresse → « Recevoir un
   code ».
3. Clique le lien du mail **dans le même navigateur** : un onglet s’ouvre et te
   connecte, l’onglet de départ suit tout seul.
4. « À jour » avec une coche : c’est synchronisé.
5. Ajoute un morceau, connecte-toi ailleurs avec la même adresse : il arrive.

Si Réglages affiche « Synchronisation impossible : … », envoie le message
exact à Claude.

## Étape 5 · Avant le jury : envoi de mails par Gmail (10 minutes, recommandé)

L’envoi intégré à Supabase est limité à **2 mails par heure** : au stand, ça
bloque dès le 3ᵉ visiteur. Un SMTP règle ça et débloque les modèles de mails
(étape 6). Le plus simple : un compte Gmail dédié (ex. une adresse créée pour
ctrl.app).

1. Sur ce compte Google, active la **validation en deux étapes** :
   <https://myaccount.google.com/signinoptions/twosv>
2. Crée un **mot de passe d’application** (nom : « Supabase ») :
   <https://myaccount.google.com/apppasswords>
   Google affiche 16 lettres : copie-les (sans les espaces).
3. Ouvre <https://supabase.com/dashboard/project/hsxsgszdzcupguuhgzlb/auth/smtp>
   (Authentication → Emails → **SMTP Settings**), active **Enable Custom SMTP** :
   - Sender email : l’adresse Gmail
   - Sender name : `ctrl.app`
   - Host : `smtp.gmail.com`
   - Port : `465`
   - Username : l’adresse Gmail
   - Password : les 16 lettres
   - Save.
4. Juste en dessous (ou Authentication → **Rate Limits**), monte
   « Rate limit for sending emails » à **30 par heure**.

Gmail accepte environ 500 mails par jour, largement assez pour le stand.
Ce mot de passe d’application reste dans Supabase : ne le donne à personne,
pas même à Claude.

Alternative sans Gmail : Brevo (gratuit, 300 mails par jour). Host
`smtp-relay.brevo.com`, port `587`, identifiant et « clé SMTP » donnés dans
Brevo → SMTP & API ; l’adresse d’envoi doit y être validée.

## Étape 6 · Mettre le code dans le mail (2 minutes, après l’étape 5)

Le code à 6 chiffres est plus pratique que le lien (le mail peut s’ouvrir sur
le téléphone pendant que l’app tourne sur l’ordinateur du stand).

1. Ouvre <https://supabase.com/dashboard/project/hsxsgszdzcupguuhgzlb/auth/templates>
2. Modèle **Magic Link** : objet « Ton code ctrl.app », et remplace le
   « Message body » par :

   ```html
   <h2>Connexion à ctrl.app</h2>
   <p>Ton code : <strong>{{ .Token }}</strong></p>
   <p>Ou clique : <a href="{{ .ConfirmationURL }}">se connecter</a></p>
   ```

3. Même chose dans le modèle **Confirm signup** (premier mail d’un nouveau
   compte). Save.
4. Essaie : l’app affiche un champ pour taper le code.

## À savoir

- Sans compte, l’app marche entièrement sur l’appareil.
- Chaque appareil reste connecté : on ne le fait qu’une fois par appareil.
- Hors ligne, tout marche ; la synchro reprend au retour du réseau.
- Au stand : Réglages → « Se déconnecter et effacer cet appareil » entre deux
  visiteurs (leurs données restent sur leur compte).
- Ne JAMAIS donner : la clé « secret » / « service_role », ni le mot de passe
  de la base.
