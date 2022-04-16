import { configureStore } from '@reduxjs/toolkit';
import guitarReducer from './guitar';
import salsaReducer from './salsa';
import harpReducer from './harp';

const store = configureStore({
    reducer: {
        guitar: guitarReducer,
        salsa: salsaReducer,
        harp: harpReducer
    }
})

export default store;