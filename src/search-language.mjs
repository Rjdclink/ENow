const stopWords=new Set('i a an the for to buy find me want need looking please cheap cheapest price online new used refurbished under less than with and or of is are some any show get power'.split(' '));
export function words(value){return String(value||'').toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').match(/[\p{L}\p{N}]+(?:[-.][\p{L}\p{N}]+)*/gu)||[];}
const compact=s=>s.replace(/[^\p{L}\p{N}]/gu,'');
export function singular(word){
  if(/ies$/.test(word)&&word.length>4)return word.slice(0,-3)+'y';
  if(/(?:boxes|watches|brushes|benches|wrenches)$/.test(word))return word.slice(0,-2);
  if(word.length>3&&/s$/.test(word)&&!/(?:ss|us|is)$/.test(word))return word.slice(0,-1);
  return word;
}
const groups=[['hidden','secret','concealed','concealment','discreet','covert'],['cubby','compartment','storage','stash','nook'],['tool','drill','saw','sander','grinder','driver','hammer','router','wrench','ratchet','planer','nailer','polisher'],['blind','shade']];
const synonyms=new Map(groups.flatMap(group=>group.map(word=>[word,new Set(group)])));
for(const term of groups[2])if(term!=='tool')synonyms.delete(term);
export function languageMatch(title,query){
  const titleWords=words(String(title).replace(/\b(?:hidden|concealed)\s+(?:wheels?|hardware|hinges?)\b/gi,'')),queryWords=words(query).filter(w=>!stopWords.has(w));
  const terms=[...new Set(queryWords.map(singular))];if(!terms.length)return 0;
  const titleSet=new Set(titleWords.map(singular));
  if(terms.some(w=>synonyms.get('hidden').has(w))&&!groups[0].some(w=>titleSet.has(w)))return 0;
  if(terms.some(w=>groups[0].includes(w))&&terms.some(w=>groups[1].includes(w))){
    const phrase=titleWords.map(singular).join(' ');
    if(!/\b(?:hidden|secret|concealed|concealment|discreet|covert)(?:\s+[^\s]+){0,2}\s+(?:cubby|compartment|storage|stash|nook)\b|\b(?:cubby|compartment|storage|stash|nook)(?:\s+[^\s]+){0,2}\s+(?:hidden|secret|concealed|concealment|discreet|covert)\b/i.test(phrase))return 0;
  }
  const identifiers=new Set(titleWords.map(compact));
  for(let i=0;i<titleWords.length-1;i++)identifiers.add(compact(titleWords[i]+titleWords[i+1]));
  // Model numbers and dimensions remain mandatory and cannot match by substring.
  if(queryWords.some(w=>/\d/.test(w)&&!identifiers.has(compact(w))))return 0;
  // FLEX the power-tool brand must not match another brand's flexible shaft.
  if(terms.includes('flex')&&terms.includes('tool')&&/\b(flex head|flex shaft|logic pro|time stretching|self.assessment|power designer|case study)\b/i.test(title))return 0;
  if(terms.includes('flex')&&terms.some(w=>synonyms.get('tool').has(w))&&!/(?:^flex\b|\bby flex\b|\bflex\s+(?:\d+\s*v\b|fx[\w-]+)|[|–—]\s*flex\s*$)/i.test(title))return 0;
  if(terms.includes('blind')&&!/\b(box|toy|hunting|tent|labubu)\b/i.test(query)&&/\b(blind box|labubu|hunting blind|ground blind)\b/i.test(title))return 0;
  let matched=0;
  for(const term of terms){
    if(/\d/.test(term)?identifiers.has(compact(term)):titleSet.has(term)||[...(synonyms.get(term)||[])].some(w=>titleSet.has(w)))matched++;
  }
  return matched/terms.length;
}
export function searchPhrases(query,alternates=[]){
  const phrases=[query];
  const add=q=>{if(typeof q==='string'&&q.trim().length>=2&&q.length<=240&&languageMatch(q,query)>=.6&&!phrases.some(p=>p.toLowerCase()===q.trim().toLowerCase()))phrases.push(q.trim());};
  // Useful even when the language-model planner is unavailable.
  const singularQuery=words(query).map(singular).join(' ');add(singularQuery);
  if(/\b(hidden|secret|concealed|concealment)\b/i.test(query)){
    add(query.replace(/\b(hidden|secret|concealed|concealment)\b/gi,'concealed').replace(/\b(cubb(?:y|ies)|compartments?|storage)\b/gi,'storage'));
    add(query.replace(/\b(hidden|secret|concealed|concealment)\b/gi,'secret').replace(/\b(cubb(?:y|ies)|compartments?|storage)\b/gi,'compartment'));
  }
  if(/^flex\s+tools?$/i.test(query))add('FLEX power tools');
  alternates.forEach(add);return phrases.slice(0,4);
}
