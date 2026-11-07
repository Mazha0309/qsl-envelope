function oneSheet(index, total, blank) {
  const x = G.ox + G.tab;
  const h1 = G.oy + G.flap;
  const h2 = h1 + G.fh;
  const tabTop = h1 + G.gap;
  const tabH = G.fh - G.gap * 2;
  const mark = state.mark ? `<div class="tabmark">Mazha0309</div>` : `<div class="glue">胶</div>`;
  const page = total > 1 ? ` 第 ${index + 1} 张，共 ${total} 张。` : "";
  const note = blank ? `手写，地址留空。${page}` : `舌页和背面在这张纸上是倒的，折过去就正了。${page}`;
  return `<div class="sheet">
    <p class="sheet-note">${note}</p>
    <div class="abs flap-slot" style="left:${x}mm;top:${G.oy}mm;width:${G.fw}mm;height:${G.flap}mm">
      ${flapStripes(false)}<div class="spin">${flapDesign(false)}</div>
    </div>
    <div class="abs" style="left:${x}mm;top:${h1}mm;width:${G.fw}mm;height:${G.fh}mm">${frontHTML(false, false)}</div>
    <div class="abs" style="left:${x}mm;top:${h2}mm;width:${G.fw}mm;height:${G.fh}mm"><div class="spin">${backDesign(false, "nobot")}</div></div>
    <div class="abs tab" style="left:${G.ox}mm;top:${tabTop}mm;width:${G.tab}mm;height:${tabH}mm">${mark}</div>
    <div class="abs tab" style="left:${x + G.fw}mm;top:${tabTop}mm;width:${G.tab}mm;height:${tabH}mm">${mark}</div>
    ${cutSVG()}
  </div>`;
}

function withJob(job, fn) {
  const prev = {
    toName: state.toName, toAddr: state.toAddr, toPhone: state.toPhone,
    toPost: state.toPost, toCountry: state.toCountry,
    fromName: state.fromName, fromAddr: state.fromAddr, fromPhone: state.fromPhone, fromPost: state.fromPost,
  };
  const person = job.person || {};
  state.toName = person.name || "";
  state.toAddr = person.addr || "";
  state.toPhone = person.phone || "";
  state.toPost = person.post || "";
  state.toCountry = person.country || "";
  if (job.blank) {
    state.fromName = "";
    state.fromAddr = "";
    state.fromPhone = "";
    state.fromPost = "";
  }
  try { return fn(); }
  finally { Object.assign(state, prev); }
}

function renderPrint() {
  const jobs = printJobs();
  $("print-root").innerHTML = jobs.map((job, i) => withJob(job, () => oneSheet(i, jobs.length, job.blank))).join("");
}

function blankCount() {
  const n = $("blank-count") ? Number($("blank-count").value) : book.blanks;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(50, Math.floor(n));
}

function printJobs() {
  const jobs = book.people.filter((p) => p.print).map((p) => ({ person: p, blank: false }));
  const empty = { name: "", addr: "", phone: "", post: "", country: "" };
  for (let i = 0; i < blankCount(); i++) jobs.push({ person: empty, blank: true });
  if (!jobs.length) {
    const cur = openPerson();
    jobs.push(cur ? { person: cur, blank: false } : { person: empty, blank: true });
  }
  return jobs;
}

function printCount() {
  const marked = book.people.filter((p) => p.print).length;
  const blanks = blankCount();
  return marked + blanks || 1;
}
