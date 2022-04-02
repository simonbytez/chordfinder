import Card from './Card';
import { salsaActions } from "../../store/salsa";
import { useDispatch, useSelector } from "react-redux";

export default function Instruments() {
    const instruments = ['piano', 'clave', 'conga', 'cowbell', 'guiro', 'timbale'];
    const dispatch = useDispatch();
    //const bassSelected = useSelector(state => state.salsa.score.parts['bass'].enabled);
    const bassSelected = false;
    //const bongoSelected = useSelector(state => state.salsa.score.parts['bongo'].enabled);
    const bongoSelected = false;
    const claveSelected = useSelector(state => state.salsa.score.parts['clave'].enabled);
    const congaSelected = useSelector(state => state.salsa.score.parts['conga'].enabled);
    const cowbellSelected = useSelector(state => state.salsa.score.parts['cowbell'].enabled);
    const guiroSelected = useSelector(state => state.salsa.score.parts['guiro'].enabled);
    const pianoSelected = useSelector(state => state.salsa.score.parts['piano'].enabled);
    const timbaleSelected = useSelector(state => state.salsa.score.parts['timbale'].enabled);

    const selected = {
        bass: bassSelected,
        bongo: bongoSelected,
        clave: claveSelected,
        conga: congaSelected,
        cowbell: cowbellSelected,
        guiro: guiroSelected,
        piano: pianoSelected,
        timbale: timbaleSelected
    }

    const cards = instruments.map(instrument => ({
        onClick: () => (dispatch(salsaActions.toggleInstrumentEnabled(instrument))),
        image: `/images/salsa/${instrument}.jpg`,
        alt: instrument,
        selected: selected[instrument]
    }))

    return <>
        <div class="instruments-wrapper" style={{
            display: 'flex', 
            flexWrap: 'wrap',
            justifyContent: 'center'
            }}>
        {cards.map(card => <Card onClick={card.onClick} image={card.image} alt={card.alt} selected={card.selected} />)}
        </div>
    </>
}