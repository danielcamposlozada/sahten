import {describe,it,expect,vi} from 'vitest';
import {INDEXNOW_KEY,INDEXNOW_URLS,notifyIndexNow} from '../scripts/deploy/indexnow.mjs';
describe('IndexNow',()=>{
 it('checks the public ownership proof before notifying only the changed public pages',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce({ok:true,text:async()=>INDEXNOW_KEY}).mockResolvedValueOnce({status:200});
  await expect(notifyIndexNow(fetcher)).resolves.toBe(200);
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({host:'sahten.online',key:INDEXNOW_KEY,urlList:INDEXNOW_URLS});
 });
 it('refuses to notify if the ownership proof is missing',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,text:async()=>'wrong'});
  await expect(notifyIndexNow(fetcher)).rejects.toThrow('ownership file');
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
});
