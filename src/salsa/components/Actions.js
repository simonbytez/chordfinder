import { salsaActions } from "../../store/salsa";
import { useDispatch, useSelector } from "react-redux";

export default function Actions() {
    const dispatch = useDispatch();
    const isAccelerating = useSelector(state => state.salsa.isAccelerating);

    function toggleAccelerate() {
        if(isAccelerating) {
            dispatch(salsaActions.stopAccelerate());
        } else {
            const interval = setInterval(() => {
            dispatch(salsaActions.increaseTempo());
            }, 7000);
        
            dispatch(salsaActions.startAccelerate(interval));
        } 
    }

    return <>
        <button style={{height: 34}} onClick={toggleAccelerate}>{isAccelerating ? 'stop accelerating' : 'accelerate'}</button>
        <button style={{height: 34, marginLeft: 8}} onClick={() => dispatch(salsaActions.decreaseTempo())}>tempo -</button>
        <button style={{height: 34, marginLeft: 8}} onClick={() => dispatch(salsaActions.increaseTempo())}>tempo +</button>
    </>
}