#!/bin/bash
# Met en ligne le service du site (Worker `rosiere` + base D1) par l'API Cloudflare, sans paquet.
#   bash server/deploy.sh   (jeton : /c/var/conf/cloudflare-workers/vmailplus.env ; cles : /c/var/conf/rosiere/)
# Idempotent : relancer = mettre a jour. Adresse : https://rosiere.<sous-domaine>.workers.dev
set -euo pipefail
cd "$(dirname "$0")"
set -a; . /c/var/conf/cloudflare-workers/vmailplus.env; set +a
: "${CF_API_TOKEN:?}" "${CF_ACCOUNT:?}"
NAME=rosiere
API=https://api.cloudflare.com/client/v4
call() { curl -sS --ssl-no-revoke -H "Authorization: Bearer $CF_API_TOKEN" "$@"; }
ok() { python -c "import json,sys;d=json.load(sys.stdin);print('ok' if d.get('success') else json.dumps(d.get('errors')))"; }

DB_ID=$(call "$API/accounts/$CF_ACCOUNT/d1/database?name=$NAME" | python -c "import json,sys;r=[x for x in json.load(sys.stdin).get('result') or [] if x['name']=='$NAME'];print(r[0]['uuid'] if r else '')")
if [ -z "$DB_ID" ]; then
  DB_ID=$(call -X POST "$API/accounts/$CF_ACCOUNT/d1/database" -H 'Content-Type: application/json' -d "{\"name\":\"$NAME\"}" | python -c "import json,sys;print(json.load(sys.stdin)['result']['uuid'])")
fi
echo "base D1 : $DB_ID"
python -c "import json;print(json.dumps({'sql':open('schema.sql',encoding='utf-8').read()}))" > .rs_schema.json
echo "schema : $(call -X POST "$API/accounts/$CF_ACCOUNT/d1/database/$DB_ID/query" -H 'Content-Type: application/json' --data @.rs_schema.json | ok)"
# Colonnes ajoutees apres coup : un fichier chacune ; « duplicate column » = deja faite.
for m in migrations/*.sql; do
  python -c "import json,sys;print(json.dumps({'sql':open(sys.argv[1],encoding='utf-8').read()}))" "$m" > .rs_migr.json
  echo "$m : $(call -X POST "$API/accounts/$CF_ACCOUNT/d1/database/$DB_ID/query" -H 'Content-Type: application/json' --data @.rs_migr.json | python -c "import json,sys;d=json.load(sys.stdin);e=json.dumps(d.get('errors'));print('ok' if d.get('success') else ('deja faite' if 'duplicate column' in e else e))")"
done
rm -f .rs_migr.json

cat > .rs_meta.json <<EOF
{"main_module":"worker.mjs","compatibility_date":"2025-09-01","keep_bindings":["secret_text"],"bindings":[
 {"type":"d1","name":"DB","id":"$DB_ID"},
 {"type":"plain_text","name":"MAIL_RELAY_URL","text":"https://api.i-call.me/rosiere_mail.php"},
 {"type":"plain_text","name":"GOLIDAY_URL","text":"https://www.domainelarosiere.com/fr"},
 {"type":"plain_text","name":"SITE_URL","text":"https://showf68.github.io/domaine-la-rosiere/"},
 {"type":"plain_text","name":"SITE_ORIGIN","text":"*"}]}
EOF
echo "worker : $(call -X PUT "$API/accounts/$CF_ACCOUNT/workers/scripts/$NAME" -F "metadata=@.rs_meta.json;type=application/json" -F "worker.mjs=@worker.mjs;type=application/javascript+module" | ok)"
for s in MAIL_KEY:rosiere_mail.key SECRET:worker_secret.key; do
  python -c "import json,sys;print(json.dumps({'name':sys.argv[1],'text':open(sys.argv[2]).read().strip(),'type':'secret_text'}))" "${s%%:*}" "/c/var/conf/rosiere/${s##*:}" > .rs_sec.json
  echo "secret ${s%%:*} : $(call -X PUT "$API/accounts/$CF_ACCOUNT/workers/scripts/$NAME/secrets" -H 'Content-Type: application/json' --data @.rs_sec.json | ok)"
done
echo "cron : $(call -X PUT "$API/accounts/$CF_ACCOUNT/workers/scripts/$NAME/schedules" -H 'Content-Type: application/json' -d '[{"cron":"*/30 * * * *"}]' | ok)"
echo "workers.dev : $(call -X POST "$API/accounts/$CF_ACCOUNT/workers/scripts/$NAME/subdomain" -H 'Content-Type: application/json' -d '{"enabled":true,"previews_enabled":false}' | ok)"
SUB=$(call "$API/accounts/$CF_ACCOUNT/workers/subdomain" | python -c "import json,sys;print(json.load(sys.stdin)['result']['subdomain'])")
rm -f .rs_meta.json .rs_schema.json .rs_sec.json
echo "en ligne : https://$NAME.$SUB.workers.dev/disponibilites.json"
