
const periodosUrl = 'data/periodos.json';
let charts = [];

function money(v){
  return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(v||0));
}
function num(v){ return Number(v || 0); }
function safeText(v){ return (v ?? '').toString().trim(); }

function parseCSV(text){
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for(let i=0;i<text.length;i++){
    const c = text[i];
    const n = text[i+1];
    if(inQuotes){
      if(c === '"' && n === '"'){ cell += '"'; i++; }
      else if(c === '"'){ inQuotes = false; }
      else { cell += c; }
    }else{
      if(c === '"'){ inQuotes = true; }
      else if(c === ','){ row.push(cell); cell = ''; }
      else if(c === '\n'){
        row.push(cell); rows.push(row); row = []; cell = '';
      }else if(c !== '\r'){ cell += c; }
    }
  }
  if(cell.length || row.length){ row.push(cell); rows.push(row); }
  if(!rows.length) return [];
  const headers = rows[0].map(h => h.replace(/^\uFEFF/, '').trim());
  return rows.slice(1).filter(r => r.some(v => safeText(v) !== '')).map(r => {
    const obj = {};
    headers.forEach((h, idx) => obj[h] = r[idx] ?? '');
    return obj;
  });
}

async function fetchCSV(url){
  const res = await fetch(url, {cache:'no-store'});
  if(!res.ok) throw new Error(`No se pudo leer ${url}`);
  const text = await res.text();
  return parseCSV(text);
}

function sum(arr, field){
  return arr.reduce((a,b) => a + num((b[field] ?? '').toString().replace(/[^\d.-]/g,'')), 0);
}
function countWhere(arr, field, value){
  return arr.filter(r => safeText(r[field]) === value).length;
}
function groupSum(arr, key, valueField){
  const out = {};
  arr.forEach(r => {
    const k = safeText(r[key]) || 'Sin dato';
    const v = num((r[valueField] ?? '').toString().replace(/[^\d.-]/g,''));
    out[k] = (out[k] || 0) + v;
  });
  return out;
}
function topEntries(grouped, topN=8){
  return Object.entries(grouped).sort((a,b)=>b[1]-a[1]).slice(0, topN);
}
function destroyCharts(){ charts.forEach(c => c.destroy()); charts = []; }
function makeChart(id, type, labels, data, label){
  const chart = new Chart(document.getElementById(id), {
    type,
    data: { labels, datasets:[{ label, data }]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:true}} }
  });
  charts.push(chart);
}
function setText(id, value){ document.getElementById(id).textContent = value; }

function renderTable(tableId, rows){
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = '';
  rows.forEach(cols => {
    const tr = document.createElement('tr');
    tr.innerHTML = cols.map(c => `<td>${c}</td>`).join('');
    tbody.appendChild(tr);
  });
}

async function loadPeriodos(){
  const res = await fetch(periodosUrl, {cache:'no-store'});
  if(!res.ok) throw new Error('No se pudo cargar periodos.json');
  return res.json();
}

async function loadPeriodData(periodo){
  const base = `data/${periodo}`;
  const files = {
    resumen: `${base}/web_Resumen_Ejecutivo.csv`,
    log: `${base}/web_Log_General.csv`,
    ventas: `${base}/web_Ventas_Master.csv`,
    datafono: `${base}/web_Datafono_Master.csv`,
    inventario: `${base}/web_Inventario_Master.csv`,
    mermas: `${base}/web_Mermas_Master.csv`,
    gastos: `${base}/web_Gastos_Master.csv`
  };

  const [resumen, log, ventas, datafono, inventario, mermas, gastos] = await Promise.all([
    fetchCSV(files.resumen),
    fetchCSV(files.log),
    fetchCSV(files.ventas),
    fetchCSV(files.datafono),
    fetchCSV(files.inventario),
    fetchCSV(files.mermas),
    fetchCSV(files.gastos)
  ]);

  return { resumen, log, ventas, datafono, inventario, mermas, gastos };
}

function renderDashboard(periodo, data){
  const {resumen, log, ventas, datafono, inventario, mermas, gastos} = data;

  const ventasTotal = sum(ventas, 'total_factura');
  const datafonoNeto = sum(datafono, 'valor_neto_abonado');
  const inventarioCompras = sum(inventario.filter(r => safeText(r['categoria_movimiento']) === 'COMPRA'), 'valor_total');
  const mermasTotal = sum(mermas, 'total_merma');
  const gastosTotal = sum(gastos, 'total');
  const resultado = ventasTotal - inventarioCompras - mermasTotal - gastosTotal;

  const okCount =
    countWhere(datafono,'estado_registro','OK') +
    countWhere(inventario,'estado_registro','OK') +
    countWhere(mermas,'estado_registro','OK') +
    countWhere(gastos,'estado_registro','OK');

  const validarCount =
    countWhere(ventas,'estado_registro','POR VALIDAR') +
    countWhere(datafono,'estado_registro','POR VALIDAR') +
    countWhere(inventario,'estado_registro','POR VALIDAR') +
    countWhere(mermas,'estado_registro','POR VALIDAR') +
    countWhere(gastos,'estado_registro','POR VALIDAR');

  const inconsCount =
    countWhere(ventas,'estado_registro','INCONSISTENTE') +
    countWhere(datafono,'estado_registro','INCONSISTENTE') +
    countWhere(inventario,'estado_registro','INCONSISTENTE') +
    countWhere(mermas,'estado_registro','INCONSISTENTE') +
    countWhere(gastos,'estado_registro','INCONSISTENTE');

  setText('selectedPeriod', periodo);
  setText('lastUpdate', new Date().toLocaleString('es-CO'));
  setText('processState', resumen.every(r => safeText(r['estado_ejecucion']) === 'OK') ? 'OK' : 'Con alertas');

  setText('kpiVentas', money(ventasTotal));
  setText('kpiDatafono', money(datafonoNeto));
  setText('kpiInventario', money(inventarioCompras));
  setText('kpiMermas', money(mermasTotal));
  setText('kpiGastos', money(gastosTotal));
  setText('kpiResultado', money(resultado));
  setText('kpiTickets', ventas.length.toLocaleString('es-CO'));
  setText('kpiTxDatafono', datafono.length.toLocaleString('es-CO'));
  setText('kpiOk', okCount.toLocaleString('es-CO'));
  setText('kpiValidar', validarCount.toLocaleString('es-CO'));
  setText('kpiIncons', inconsCount.toLocaleString('es-CO'));

  destroyCharts();
  makeChart('chartComposicion', 'bar',
    ['Ventas', 'Inventario', 'Mermas', 'Gastos'],
    [ventasTotal, inventarioCompras, mermasTotal, gastosTotal],
    'Valor');

  makeChart('chartComparativo', 'bar',
    ['Ventas facturadas', 'Recaudo neto datáfono'],
    [ventasTotal, datafonoNeto],
    'Valor');

  const ventasSede = groupSum(ventas, 'sede_homologada', 'total_factura');
  makeChart('chartVentasSede', 'pie', Object.keys(ventasSede), Object.values(ventasSede), 'Ventas');

  const datafonoSede = groupSum(datafono, 'sede', 'valor_neto_abonado');
  makeChart('chartDatafonoSede', 'pie', Object.keys(datafonoSede), Object.values(datafonoSede), 'Datáfono');

  const gastosCat = groupSum(gastos, 'categoria_principal', 'total');
  makeChart('chartGastosCat', 'bar', Object.keys(gastosCat), Object.values(gastosCat), 'Gastos');

  const topGastos = topEntries(groupSum(gastos, 'proveedor', 'total'));
  renderTable('tablaProveedoresGastos', topGastos.map(([k,v]) => [k, money(v)]));

  const topInv = topEntries(groupSum(inventario.filter(r => safeText(r['categoria_movimiento']) === 'COMPRA'), 'proveedor', 'valor_total'));
  renderTable('tablaProveedoresInv', topInv.map(([k,v]) => [k, money(v)]));

  renderTable('tablaAlertas', [
    ['Ventas', `Por validar: ${countWhere(ventas,'estado_registro','POR VALIDAR')} | Inconsistentes: ${countWhere(ventas,'estado_registro','INCONSISTENTE')}`],
    ['Datafono', `Por validar: ${countWhere(datafono,'estado_registro','POR VALIDAR')} | Inconsistentes: ${countWhere(datafono,'estado_registro','INCONSISTENTE')}`],
    ['Inventario', `Por validar: ${countWhere(inventario,'estado_registro','POR VALIDAR')} | Inconsistentes: ${countWhere(inventario,'estado_registro','INCONSISTENTE')}`],
    ['Mermas', `Por validar: ${countWhere(mermas,'estado_registro','POR VALIDAR')} | Inconsistentes: ${countWhere(mermas,'estado_registro','INCONSISTENTE')}`],
    ['Gastos', `Por validar: ${countWhere(gastos,'estado_registro','POR VALIDAR')} | Inconsistentes: ${countWhere(gastos,'estado_registro','INCONSISTENTE')}`]
  ]);

  renderTable('tablaResumen',
    resumen.map(r => [
      safeText(r['master']),
      safeText(r['estado_ejecucion']),
      safeText(r['filas_procesadas']),
      safeText(r['observacion'])
    ])
  );

  const statusLines = [];
  log.forEach(r => {
    statusLines.push(`${safeText(r['momento'])} | ${safeText(r['evento'])} | ${safeText(r['detalle'])}`);
  });
  document.getElementById('statusLog').textContent = statusLines.join('\n');
}

async function init(){
  const select = document.getElementById('periodoSelect');
  const reloadBtn = document.getElementById('reloadBtn');
  try{
    const data = await loadPeriodos();
    const periodos = data.periodos || [];
    select.innerHTML = '';
    periodos.forEach(p => {
      const option = document.createElement('option');
      option.value = p;
      option.textContent = p;
      select.appendChild(option);
    });

    async function refresh(){
      const periodo = select.value;
      const periodData = await loadPeriodData(periodo);
      renderDashboard(periodo, periodData);
    }

    select.addEventListener('change', refresh);
    reloadBtn.addEventListener('click', refresh);

    if(periodos.length){
      await refresh();
    }else{
      document.getElementById('statusLog').textContent = 'No hay períodos disponibles en data/periodos.json';
    }
  }catch(err){
    document.getElementById('statusLog').textContent = 'Error cargando tablero: ' + err.message;
  }
}
init();
