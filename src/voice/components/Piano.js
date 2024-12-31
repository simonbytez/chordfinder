
import {Piano} from "@tonejs/piano";

export default function Main() {

// create the piano and load 5 velocity steps
const piano = new Piano({
  velocities: 5
})

//connect it to the speaker output
piano.toDestination()
return (<>
Piano!
</>)
}