// Recognition only: no OTP and no claim of verified identity.
// Argentina: +54/+549 and national 10-digit formats share one canonical key.
export function normalizeLoyaltyPhone(value){
 const text=String(value??'').trim();let digits=text.replace(/\D/g,'');
 if(digits.startsWith('00'))digits=digits.slice(2);
 const international=text.startsWith('+')||text.startsWith('00');
 if(international&&!digits.startsWith('54'))return /^[1-9][0-9]{6,14}$/.test(digits)?'+'+digits:null;
 if(international&&digits.startsWith('54')&&![12,13].includes(digits.length))return null;
 if(digits.length===13&&digits.startsWith('549'))digits=digits.slice(3);
 else if(digits.length===12&&digits.startsWith('54'))digits=digits.slice(2);
 else if(digits.length===11&&digits.startsWith('0'))digits=digits.slice(1);
 if(digits.length===10)return '+54'+digits;
 // International numbers must include + (or 00), never guess their country.
 if((text.startsWith('+')||text.startsWith('00'))&&/^[1-9][0-9]{10,14}$/.test(digits))return '+'+digits;
 return null;
}
