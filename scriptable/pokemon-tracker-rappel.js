// Rappel quotidien "Export collection Pokémon" — à utiliser avec Scriptable (iOS)
//
// === INSTALLATION ===
// 1. App Scriptable > nouveau script > colle ce fichier entier, renomme-le
//    (ex: "Pokemon Tracker Rappel"), sauvegarde.
// 2. App Raccourcis (Shortcuts) > onglet Automatisation > + > Automatisation
//    personnelle > "Heure de la journée" > 18:00, tous les jours.
//    Action : "Exécuter le script Scriptable" > choisis ce script.
//    Désactive "Demander avant d'exécuter" pour que ça tourne tout seul.
// 3. C'est tout : à 18h une notification apparaît. Le tap dessus relance ce
//    même script, qui tente d'ouvrir iEstim (voir === LIMITES === ci-dessous).
//
// === CE QUE FAIT LE SCRIPT ===
// - Lancé par l'automatisation Raccourcis à 18h -> envoie une notification locale.
// - Lancé en tapant sur cette notification -> tente d'ouvrir l'app iEstim.
// - La suite (Partager le CSV depuis iEstim -> choisir l'app Claude -> choisir
//   le Projet "Pokémon Tracker") reste un geste manuel : iEstim n'a pas d'API
//   et Scriptable ne peut pas cliquer dans une autre app.
//
// === LIMITES CONNUES ===
// - IESTIM_URL_SCHEME ci-dessous est une estimation ("iestim://"), pas une
//   valeur confirmée : il faudra vérifier sur l'iPhone si iEstim répond à ce
//   scheme (ou à un autre) et l'ajuster ici. Si l'ouverture échoue, le script
//   affiche une alerte claire plutôt que d'échouer silencieusement — la
//   notification reste de toute façon un rappel fiable même si le deep link
//   ne marche pas.

const IESTIM_URL_SCHEME = "iestim://";

async function sendReminder() {
  const n = new Notification();
  n.title = "Export collection Pokémon 📦";
  n.body = "Appuie pour ouvrir iEstim, exporte le CSV, puis partage-le vers le Projet Claude dédié.";
  n.scriptName = Script.name();
  n.sound = "default";
  await n.schedule();
}

async function openIEstim() {
  try {
    const cb = new CallbackURL(IESTIM_URL_SCHEME);
    await cb.open();
  } catch (e) {
    const alert = new Alert();
    alert.title = "Impossible d'ouvrir iEstim automatiquement";
    alert.message =
      "Le lien direct vers iEstim n'a pas fonctionné (scheme à vérifier). " +
      "Ouvre l'app manuellement, exporte le CSV, puis partage-le vers le Projet Claude dédié.";
    alert.addAction("OK");
    await alert.present();
  }
}

if (args.notification) {
  await openIEstim();
} else {
  await sendReminder();
}

Script.complete();
