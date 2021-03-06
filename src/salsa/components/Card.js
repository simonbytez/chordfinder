import MuiCard from '@mui/material/Card';
import {CardMedia} from '@mui/material';

export default function Card(props) {
    return <>
        <MuiCard style={{
            width: 100,
            height: 100,
            margin: 12
        }}>
            <div onClick={props.onClick}>
                <CardMedia
                    component="img"
                    image={props.image}
                    alt={props.alt}
                    style={{
                        width: 100,
                        height: 100,
                        opacity: props.selected ? 1.0 : 0.5,
                        objectFit: 'contain',
                        cursor: 'pointer'
                    }}
                />
            </div>
        </MuiCard>
    </>
}