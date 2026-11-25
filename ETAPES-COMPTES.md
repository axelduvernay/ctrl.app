# ctrl.app : activer les comptes et la synchronisation

À faire une seule fois, dans l’ordre. Compte 10 minutes. Le code est prêt et
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

## Étape 2 · Mettre le code dans le mail (2 minutes, important)

Par défaut, le mail ne contient qu’un lien. L’app accepte ce lien, mais le
**code à 6 chiffres** est plus pratique (surtout sur téléphone, ou si le mail
s’ouvre sur un autre appareil).

1. Ouvre les modèles de mails :
   <https://supabase.com/dashboard/project/hsxsgszdzcupguuhgzlb/auth/templates>
   (menu de gauche → **Authentication** → **Emails** ou « Email Templates »).
2. Dans le modèle **Magic Link**, remplace tout le contenu (« Message body »)
   par le texte ci-dessous, puis **Save** :

   ```html
   <h2>Connexion à ctrl.app</h2>
   <p>Ton code : <strong>{{ .Token }}</strong></p>
   <p>Ou clique : <a href="{{ .ConfirmationURL }}">se connecter</a></p>
   ```

3. Fais **la même chose** dans le modèle **Confirm signup** (c’est le mail
   reçu la toute première fois, quand le compte est créé). Save.
4. Tu peux aussi changer l’objet (« Subject ») : par exemple
   « Ton code ctrl.app ».

## Étape 3 · Régler les adresses (1 minute)

<https://supabase.com/dashboard/project/hsxsgszdzcupguuhgzlb/auth/url-configuration>
(Authentication → **URL Configuration**) :

- **Site URL** : `https://axelduvernay.github.io/ctrl.app/`
- **Redirect URLs** → « Add URL », ajoute les deux :
  - `https://axelduvernay.github.io/ctrl.app/`
  - `http://localhost:5173/ctrl.app/`
- Save.

## Étape 4 · Vérifier le code à 6 chiffres (30 secondes)

<https://supabase.com/dashboard/project/hsxsgszdzcupguuhgzlb/auth/providers>
(Authentication → **Sign In / Providers** → **Email**) :

- « Enable Email provider » : activé.
- « Email OTP Length » (longueur du code) : **6**. Save.
- Laisse les inscriptions ouvertes (« Allow new users to sign up ») : au
  stand, chaque visiteur peut créer son compte.

## Étape 5 · Essayer

1. Ouvre <https://axelduvernay.github.io/ctrl.app/> et recharge (⌘⇧R).
2. Réglages → **Compte et synchronisation** → ton adresse → « Recevoir un
   code » → tape le code du mail (ou clique le lien).
3. « À jour » avec une coche : c’est synchronisé.
4. Ajoute un morceau, puis ouvre l’app dans un autre navigateur (ou sur ton
   téléphone) et connecte-toi avec la même adresse : le morceau arrive.

Si Réglages affiche « Synchronisation impossible : … », envoie le message
exact à Claude.

## Étape 6 · Avant le jury : un vrai envoi de mails (recommandé)

L’envoi intégré à Supabase est limité à quelques mails par heure : au stand,
avec plusieurs visiteurs, ça bloquera vite (« Trop de mails envoyés »).

<https://supabase.com/dashboard/project/hsxsgszdzcupguuhgzlb/auth/smtp>
(Authentication → Emails → **SMTP Settings**) : active « Custom SMTP » avec
un service gratuit comme Resend ou Brevo (ils donnent l’hôte, le port,
l’identifiant et le mot de passe à recopier). Claude peut t’aider pas à pas.

## À savoir

- Sans compte, l’app marche entièrement sur l’appareil.
- Chaque appareil reste connecté : on ne le fait qu’une fois par appareil.
- Hors ligne, tout marche ; la synchro reprend au retour du réseau.
- Au stand : Réglages → « Se déconnecter et effacer cet appareil » entre deux
  visiteurs (leurs données restent sur leur compte).
- Ne JAMAIS donner : la clé « secret » / « service_role », ni le mot de passe
  de la base.
