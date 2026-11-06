// Public ownership proof: this key is intentionally served on the website.
export const INDEXNOW_KEY='c8df0a44121ddb43eaed162d5a0362e0';
export const INDEXNOW_HOST='sahten.online';
export const INDEXNOW_URLS=['https://sahten.online/','https://sahten.online/menu/'];
export async function notifyIndexNow(fetcher=fetch){
 const proof=await fetcher(`https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,{signal:AbortSignal.timeout(20000)});
 if(!proof.ok || (await proof.text()).trim()!==INDEXNOW_KEY) throw new Error('IndexNow: ownership file not available');
 const response=await fetcher('https://api.indexnow.org/indexnow',{
  method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},
  body:JSON.stringify({host:INDEXNOW_HOST,key:INDEXNOW_KEY,urlList:INDEXNOW_URLS}),signal:AbortSignal.timeout(20000)
 });
 if(![200,202].includes(response.status)) throw new Error(`IndexNow returned HTTP ${response.status}`);
 return response.status;
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
 try{console.log('IndexNow notification accepted:',await notifyIndexNow());}
 catch(err){console.error(String(err));process.exitCode=1;}
}
