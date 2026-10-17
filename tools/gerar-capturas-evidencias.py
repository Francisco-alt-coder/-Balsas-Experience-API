#!/usr/bin/env python3
# Evidências geradas a partir de requisições HTTP reais, em banco isolado de CI.
import datetime as dt
import html
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request
import urllib.error

ROOT = Path("evidencias-reais")
ROOT.mkdir(exist_ok=True)
LOCAL = "http://127.0.0.1:3000"
REMOTE = "https://balsas-experience-api-g7ru.onrender.com/"
TOKEN = os.environ["API_WRITE_TOKEN"]
records = []

def call(method, url, data=None, remote=False):
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
        headers["Authorization"] = "Bearer " + TOKEN
    req = urllib.request.Request(url, data=json.dumps(data, ensure_ascii=False).encode("utf-8") if data is not None else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=90 if remote else 15) as r:
            return r.status, r.read().decode("utf-8", errors="replace"), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace"), dict(e.headers)

def pretty(body):
    if not body:
        return "(Sem corpo: resposta HTTP 204)"
    try:
        return json.dumps(json.loads(body), ensure_ascii=False, indent=2)
    except Exception:
        return body[:8000]

def capture(num, title, method, url, expected, status, body, req_body=None, error=None):
    observed = str(status) if status else "NÃO OBTIDO"
    good = status == expected
    date = dt.datetime.now(dt.timezone.utc).strftime("%d/%m/%Y %H:%M:%S UTC")
    stamp = "CONFIRMADO" if good else "NÃO COMPROVADO"
    path = ROOT / f"evidencia-{num}.html"
    req_print = html.escape(json.dumps(req_body, ensure_ascii=False, indent=2)) if req_body is not None else "(sem corpo)"
    response = html.escape(pretty(body)) if not error else html.escape(str(error))
    safeurl = html.escape(url)
    content = f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <style>body{{font-family:Arial,sans-serif;background:#edf2f7;color:#112337;margin:0;padding:33px}}
    main{{max-width:1160px;margin:auto;background:white;border:1px solid #c9d5de;border-radius:16px;box-shadow:0 6px 24px #d2dce2;overflow:hidden}}
    header{{padding:26px 31px;background:#0d3449;color:white;display:flex;justify-content:space-between}}
    h1{{margin:0;font-size:26px}} .small{{font-size:13px;opacity:.8;margin-top:7px}}
    article{{padding:25px 30px}} .group{{margin-bottom:20px}} .label{{text-transform:uppercase;letter-spacing:1px;font-weight:bold;font-size:12px;color:#5c6e7b;margin-bottom:9px}}
    .url{{display:flex;align-items:center;border:1px solid #cad4dc;border-radius:9px;overflow:hidden;min-height:57px;background:#f8fafc}}
    .method{{font-size:17px;font-weight:bold;padding:19px;background:#dfeaf2;color:#064361}}
    .address{{padding:18px 14px;font-family:monospace;font-size:16px;overflow-wrap:anywhere}}
    .status{{font-size:20px;font-weight:bold;padding:17px 20px;background:{'#e5f6e9' if good else '#fff0e4'};color:{'#126634' if good else '#a83b16'};border-radius:8px;display:inline-block}}
    pre{{background:#112636;color:#e3f6e7;white-space:pre-wrap;overflow-wrap:anywhere;padding:20px;border-radius:9px;font-size:14px;line-height:1.5;max-height:440px;overflow:hidden}}
    footer{{border-top:1px solid #e3eaf0;padding:17px 30px;font-size:13px;color:#526575}}
    </style></head><body><main><header><div><h1>Balsas Experience API | Evidência {num}</h1>
    <div class="small">{html.escape(title)} • Requisição HTTP executada de verdade</div></div><div>{html.escape(date)}</div></header>
    <article><div class="group"><div class="label">Requisição</div><div class="url"><div class="method">{method}</div><div class="address">{safeurl}</div></div></div>
    <div class="group"><div class="label">Status HTTP observado</div><div class="status">{html.escape(observed)} • {stamp}</div><span style="margin-left:18px">Esperado: {expected}</span></div>
    {'<div class="group"><div class="label">Corpo enviado (Authorization: Bearer [OCULTO])</div><pre>'+req_print+'</pre></div>' if req_body is not None else ''}
    <div class="group"><div class="label">Resposta do servidor</div><pre>{response}</pre></div></article>
    <footer>Fonte: requisição HTTP real executada no GitHub Actions. {'Banco de testes PostgreSQL isolado da produção.' if num<5 else 'Consulta pública HTTPS ao serviço Render.'} Captura do relatório pelo navegador Chrome.</footer>
    </main></body></html>"""
    path.write_text(content, encoding="utf-8")
    chrome = next((x for x in ("google-chrome", "chromium", "chromium-browser") if subprocess.run(["which",x],capture_output=True).returncode == 0), None)
    if not chrome:
        raise RuntimeError("Navegador Chrome não encontrado no runner")
    cmd=[chrome, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--disable-dev-shm-usage", "--window-size=1380,1020", f"--screenshot={str((ROOT / f'evidencia-{num}.png').resolve())}", path.resolve().as_uri()]
    proc=subprocess.run(cmd, capture_output=True, text=True, timeout=40)
    if proc.returncode != 0:
        raise RuntimeError("Falha ao capturar com Chrome: " + proc.stderr[-400:])
    records.append({"numero":num,"metodo":method,"url":url,"esperado":expected,"obtido":status,"aprovado":good,"data_utc":date,"origem":"CI isolado" if num<5 else "Render publico"})
    print(f"EVIDENCIA {num}: {method} {url}: HTTP {status} -> {'APROVADO' if good else 'FALHOU'}",flush=True)

# Aguarda API local responder.
for i in range(50):
    try:
        status, _, _ = call("GET", LOCAL + "/")
        if status==200: break
    except Exception: time.sleep(1)
else: raise RuntimeError("Servidor local não iniciou")
status, body, _ = call("GET",LOCAL+"/atracoes?formato=json")
capture(1,"Listagem de atrações", "GET", LOCAL+"/atracoes?formato=json",200,status,body)

status, body, _ = call("GET",LOCAL+"/atracoes/999999?formato=json")
capture(2,"Atração inexistente","GET",LOCAL+"/atracoes/999999?formato=json",404,status,body)

data={"nome":"Evidência acadêmica temporária CI","categoria":"Lazer","descricao":"Registro temporário de teste isolado.","localizacao":{"cidade":"Balsas","estado":"MA"},"distanciaCentroKm":3,"tags":[]}
status, body, _ = call("POST",LOCAL+"/atracoes",data)
capture(3,"Cadastro temporário","POST",LOCAL+"/atracoes",201,status,body,req_body=data)
assert status==201,"Cadastro falhou: não é seguro tentar DELETE arbitrário."
newid=json.loads(body)["id"]
assert isinstance(newid,int) and newid > 0
delurl=LOCAL+"/atracoes/"+str(newid)
# Para DELETE: Request sem corpo, mas com token. Não mostrar token.
req=urllib.request.Request(delurl,headers={"Authorization":"Bearer "+TOKEN,"Accept":"application/json"},method="DELETE")
try:
    with urllib.request.urlopen(req,timeout=15) as r:
        status,body=r.status,r.read().decode("utf-8",errors="replace")
except urllib.error.HTTPError as e:
    status,body=e.code,e.read().decode("utf-8",errors="replace")
capture(4,"Exclusão do mesmo registro temporário","DELETE",delurl,204,status,body)

try:
    remote_status,remote_body,_=call("GET",REMOTE,remote=True)
    capture(5,"Serviço publicado em HTTPS","GET",REMOTE,200,remote_status,remote_body)
except Exception as e:
    capture(5,"Serviço publicado em HTTPS (acesso não confirmado)","GET",REMOTE,200,None,"",error=f"Falha de conexão: {type(e).__name__}: {e}")

(ROOT / "manifesto.json").write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding="utf-8")
assert all(item["aprovado"] for item in records),"Há evidências não confirmadas; ver manifesto."
