export const abbrs = {
    wall: 'WL',
    flag: 'FL',
    brute: 'BR',
    pawn: 'PA',
    scanner: 'SR',
    sniper: 'SN',
    scout: 'SC',
    jail: 'JL',
    jammer: 'JM',
    listener: 'LI'
  };

  export function typeCategory(type) {
    if(['brute', 'sniper', 'scanner', 'destroyer', 'scout', 'jammer', 'listener', 'pawn'].includes(type)) {
      return 'person'
    } else {
      return type
    }
  }