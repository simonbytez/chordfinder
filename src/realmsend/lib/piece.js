import { Directions } from "@mui/icons-material";
import {abbrs} from './consts'

let nextId = 1;
function genPieceId() {
  return nextId++;
}

export default class Piece {
    player
    type
    direction
    constructor(player, type, direction) {
        this.player = player
        this.type = type
        this.direction = direction
        this.id = genPieceId()
    }

    get category() {
        if(['brute', 'sniper', 'scanner', 'destroyer', 'scout', 'jammer', 'listener'].includes(this.type)) {
            return 'person'
        } else {
            return this.type
        }
    }

    get color() {
        if(['brute', 'sniper', 'scanner', 'destroyer', 'scout', 'jammer', 'listener'].includes(this.type)) {
            return 'black'
        } else if(this.type == 'wall') {
            return 'brown'
        } else if(this.type == 'flag') {
            return 'red'
        } else if(this.type == 'device') {
            return 'green'
        }
    }
    
    get typeAbbr() {
        return abbrs[this.type]
    }
}