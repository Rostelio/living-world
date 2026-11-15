// Procedural name generation per race.
const SYL = {
  humans: {
    start: ['Al', 'Bran', 'Cal', 'Dun', 'Ed', 'Fal', 'Gar', 'Hal', 'Ash', 'Mar', 'Nor', 'Os', 'Ro', 'Sten', 'Tor', 'Wil', 'Ever', 'Lin', 'Hart', 'Kings', 'Wester', 'Brig'],
    mid: ['', '', '', 'en', 'or', 'an', 'il', 'ar'],
    end: ['ford', 'ton', 'bury', 'wick', 'mere', 'dale', 'holm', 'stead', 'gate', 'by', 'ham', 'mouth', 'field', 'bridge'],
    male: ['Aldric', 'Bran', 'Cedric', 'Duncan', 'Edmund', 'Gareth', 'Harold', 'Osric', 'Roland', 'Tristan', 'Willem', 'Leofric', 'Godwin', 'Alaric', 'Conrad'],
    female: ['Adela', 'Brigid', 'Cecily', 'Edith', 'Gwen', 'Helena', 'Isolde', 'Matilda', 'Rosalind', 'Sybil', 'Elinor', 'Maud', 'Agnes', 'Beatrix'],
    dyn: ['Ashford', 'Blackwood', 'Durand', 'Harlow', 'Marlowe', 'Stanmere', 'Tarrow', 'Vance', 'Whitmore', 'Aldane', 'Corvin', 'Redmayne'],
  },
  elves: {
    start: ['Ae', 'Ael', 'Cel', 'Ely', 'Fae', 'Gal', 'Ith', 'Lae', 'Lor', 'Mel', 'Nim', 'Sil', 'Thal', 'Yla', 'Ara', 'Eri'],
    mid: ['', 'ri', 'la', 'the', 'nde', 'va', 'si'],
    end: ['thil', 'ndor', 'lien', 'wyn', 'asse', 'oriel', 'anor', 'eth', 'ion', 'ara', 'quen', 'aris'],
    male: ['Aelthir', 'Caladon', 'Elrion', 'Faelar', 'Galathil', 'Ithrandir', 'Lorien', 'Nimlas', 'Thalion', 'Sylvar', 'Erevan'],
    female: ['Aelwen', 'Celebriel', 'Elyndra', 'Faenya', 'Ithiliel', 'Laerith', 'Melisande', 'Nimue', 'Sylwen', 'Yllara', 'Arwyth'],
    dyn: ['Silverleaf', 'Starbloom', 'Moonwhisper', 'Dawnsong', 'Thalassar', 'Evenmist', 'Galanodel', 'Ilphelkiir'],
  },
  dwarves: {
    start: ['Bar', 'Dur', 'Grim', 'Kaz', 'Khaz', 'Thor', 'Bal', 'Dvar', 'Gund', 'Mor', 'Az', 'Brok', 'Kar', 'Thrum'],
    mid: ['', '', 'ak', 'un', 'om', 'az'],
    end: ['heim', 'dum', 'hold', 'grund', 'rak', 'dor', 'forge', 'karak', 'mund', 'zak', 'deep'],
    male: ['Balin', 'Durgan', 'Gimrak', 'Thorgrim', 'Kazrik', 'Brokk', 'Dvalin', 'Gundar', 'Morgrim', 'Rurik', 'Thrain'],
    female: ['Bryndis', 'Dagna', 'Grenna', 'Helga', 'Kathra', 'Morna', 'Thyra', 'Vistra', 'Hilde', 'Eldeth'],
    dyn: ['Ironfist', 'Stonehelm', 'Deepdelver', 'Goldbeard', 'Hammerfall', 'Anvilborn', 'Coppervein', 'Granitejaw'],
  },
  orcs: {
    start: ['Gro', 'Ug', 'Mog', 'Rak', 'Zug', 'Gor', 'Skar', 'Thra', 'Durz', 'Grak', 'Lug', 'Nar', 'Bol', 'Krag'],
    mid: ['', '', 'ash', 'uk', 'ur', 'ag'],
    end: ['gash', 'mok', 'zug', 'dush', 'rak', 'goth', 'krag', 'bur', 'nak', 'ghul', 'thar'],
    male: ['Grommash', 'Urzog', 'Mogrul', 'Rakgar', 'Zugthak', 'Gorbag', 'Skarn', 'Thrall', 'Durgash', 'Krulak', 'Bolg'],
    female: ['Grasha', 'Ugra', 'Morka', 'Razza', 'Zagha', 'Gorza', 'Shagra', 'Bashka', 'Durza', 'Nagra'],
    dyn: ['Bloodfang', 'Skullsplitter', 'Ironjaw', 'Blackhand', 'Warsong', 'Thunderlord', 'Bonechewer', 'Shattered Hand'],
  },
};

SYL.lizardfolk = {
  start: ['Ssa', 'Kesh', 'Tzi', 'Xal', 'Ixa', 'Zhar', 'Sith', 'Kaz', 'Tlo', 'Ssi', 'Qua', 'Yax'],
  mid: ['', '', 'ss', 'ix', 'za', 'th'],
  end: ['ath', 'kesh', 'tlan', 'xal', 'ssar', 'ixa', 'oth', 'sk', 'zil', 'quan', 'mire'],
  male: ['Sskar', 'Kethis', 'Xalath', 'Tzikri', 'Ixmal', 'Zharox', 'Sithrak', 'Quetlan', 'Yaxkin'],
  female: ['Ssyla', 'Kesra', 'Ixia', 'Tzala', 'Xilsa', 'Zhessa', 'Sithra', 'Quala', 'Yaxa'],
  dyn: ['Coldscale', 'Marshborn', 'Jadefang', 'Mirebrood', 'Suncrest', 'Venomtongue', 'Reedcoil'],
};
SYL.halflings = {
  start: ['Bram', 'Hob', 'Tuck', 'Under', 'Over', 'Green', 'Mug', 'Fern', 'Willow', 'Thistle', 'Apple', 'Honey'],
  mid: ['', '', 'ble', 'ber', 'ly'],
  end: ['bottom', 'hill', 'hollow', 'burrow', 'dell', 'brook', 'bury', 'field', 'wick', 'mead'],
  male: ['Milo', 'Tobias', 'Wendel', 'Perrin', 'Cobb', 'Rufus', 'Barnaby', 'Osbert', 'Hamlin', 'Corwin'],
  female: ['Poppy', 'Clover', 'Daisy', 'Hazel', 'Tansy', 'Bryony', 'Myrtle', 'Wren', 'Linnea'],
  dyn: ['Underbough', 'Applewhistle', 'Goodbarrel', 'Thornbrook', 'Honeywell', 'Mossbank', 'Hilltopple'],
};

const PROV = {
  start: ['Ar', 'Bel', 'Cor', 'Dra', 'Es', 'Fen', 'Gal', 'Hel', 'Ir', 'Kar', 'Lys', 'Mor', 'Nar', 'Or', 'Pel', 'Quar', 'Ros', 'Sar', 'Tal', 'Ul', 'Ver', 'Wen', 'Yr', 'Zan', 'Ast', 'Bryn', 'Cael', 'Dor'],
  mid: ['a', 'e', 'i', 'o', 'an', 'er', 'in', 'ol', '', '', 'ad', 'ev'],
  end: ['ia', 'on', 'ar', 'eth', 'is', 'um', 'or', 'al', 'en', 'os', 'ane', 'mark', 'vale', 'mor', 'wyn', 'esh'],
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function provinceName(rng) {
  return cap(rng.pick(PROV.start) + rng.pick(PROV.mid) + rng.pick(PROV.end));
}

export function settlementName(race, rng) {
  const s = SYL[race];
  let n = rng.pick(s.start) + rng.pick(s.mid) + rng.pick(s.end);
  return cap(n.toLowerCase());
}

export function realmName(race, rng) {
  const s = SYL[race];
  return cap((rng.pick(s.start) + rng.pick(s.mid) + rng.pick(['ia', 'ar', 'or', 'en', 'heim', 'oth', 'and', 'ia', 'um'])).toLowerCase());
}

export function personName(race, gender, rng) {
  return rng.pick(SYL[race][gender === 'f' ? 'female' : 'male']);
}

export function dynastyName(race, rng) {
  return rng.pick(SYL[race].dyn);
}
