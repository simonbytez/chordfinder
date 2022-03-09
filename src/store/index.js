import { configureStore } from '@reduxjs/toolkit';
import guitarReducer from './guitar';
import salsaReducer from './salsa';

const store = configureStore({
    reducer: {
        guitar: guitarReducer,
        salsa: salsaReducer
    }
})

export default store;