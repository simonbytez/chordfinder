import { createSlice } from "@reduxjs/toolkit";
import _, { padStart } from "lodash";
import { createSelector } from "reselect";
import defaultData from '../harp/data/default';

function getCategoryOptions(options, categories) {
  let categoryOptions = {};

    for(let categoryId in categories) {
      categoryOptions[categoryId] = []
    }

    for(let optionId in options) {
      let categoryId = options[optionId].categoryId;
      categoryOptions[categoryId].push({optionId, enabled: options[optionId].enabled});
    }

    return categoryOptions;
}

export const categoryOptions = createSelector(
  [(state) => state.options, state => state.categories], (options, categories) => {
    return getCategoryOptions(options, categories);
  }
);

export const timingCategoryOptions = createSelector(
  [state => state.timings, state => state.options, state => state.categories], (timings, options, categories) => {
    let timingCategoryOptions = [];
    for(let timingId in timings) {
      let timing = timings[timingId];
      let categoryOptions = {};
      for(let categoryId in timing.options) {
        let categoryData = timing.options[categoryId];
        const categoryDataOptions = categoryData.options;
        for(let optionId in categoryDataOptions) {
          if(!options[optionId].enabled || !categories[categoryId].enabled) { continue };
        
          if(!categoryOptions[categoryId]) {
            categoryOptions[categoryId] = {enabled: categoryData.enabled, optional: categoryData.optional, options: []};
          }
    
          categoryOptions[categoryId].options.push({optionId, enabled: categoryDataOptions[optionId]});
        }
      }
      
      timingCategoryOptions.push({id: timingId, start: timing.start, end: timing.end, options: categoryOptions});
    }

    return timingCategoryOptions.sort((t1, t2) => t1.start - t2.start);
  }
);

export const getPattern = state => {
    let ret = [];
    const allOptions = state.options;
    const categories = state.categories;
    const timings = state.timings;
    let tcos = timingCategoryOptions(state);
    for(let timing of tcos) {
      let val = {id: timing.id, start: timing.start, end: timing.end, choices: {}};
      for(let categoryId in timing.options) {
        const {enabled: categoryEnabled, options, optional} = timing.options[categoryId];
        options = options.filter(option => option.enabled && categoryEnabled);

        if(options.length == 0 || (optional && Math.random() < 0.5)) { continue };

        let { type: categoryType } = categories[categoryId];
        let choice = options[options.length * Math.random() | 0];

        if(!val.choices[categoryType]) {
          val.choices[categoryType] = {}
        }

        val.choices[categoryType][categoryId] = choice.optionId;
      }

      if(Object.keys(val.choices).length > 0) {
        ret.push(val);
      }
    }

    return ret;
  }

const harpSlice = createSlice({
  name: "harp",
  initialState: {
    categories: defaultData.categories,
    options: defaultData.options,
    timings: defaultData.timings
  },
  reducers: {
    toggleEnableOption(state, action) {
      state.options[action.payload].enabled = !state.options[action.payload].enabled;
    },
    toggleEnableTimingOption(state, action) {
      let { timingId, categoryId, optionId } = action.payload;
      let options = state.timings[timingId].options[categoryId].options;
      options[optionId] = !options[optionId];
    },
    toggleCategoryEnabled(state, action) {
      state.categories[action.payload].enabled = !state.categories[action.payload].enabled;
    },
    toggleTimingCategoryEnabled(state, action) {
      const {timingId, categoryId} = action.payload;
      state.timings[timingId].options[categoryId].enabled = !state.timings[timingId].options[categoryId].enabled;
      console.log('toggle timing category enabled');
    },
    deleteCategory(state, action) {
      let categoryId = action.payload;
      for(let timingId in state.timings) {
        let {options} = state.timings[timingId];
        for(let optionCategoryId in options) {
          if(optionCategoryId == categoryId) {
            delete options[optionCategoryId];
          }
        }
      }

      for(let optionId in state.options) {
        let option = state.options[optionId];
        if(option.categoryId == categoryId) {
          delete state.options[optionId];
        }
      }

      delete state.categories[action.payload];

    },
    deleteCategoryOption(state, action) {
      const optionId = action.payload;

      for(let timingId in state.timings) {
        const timing = state.timings[timingId];
        for(let categoryId in timing.options) {
          const categoryData = timing.options[categoryId];
          for(let oid in categoryData.options) {
            if(optionId == oid) {
              delete categoryData.options[oid];
            }
          }
        }
      }

      delete state.options[optionId];
    },
    addCategory(state, action) {
      const {type, name} = action.payload;

      let newCategoryId = 1;
      let categoryKeys = Object.keys(state.categories);
      if(categoryKeys.length > 0) {
        newCategoryId = +categoryKeys.sort((k1, k2) => k2 - k1)[0] + 1;
      }

      state.categories[newCategoryId] = {type, name, enabled: true};
    },
    addCategoryOption(state, action) {
      const {categoryId, name} = action.payload;

      let newOptionId = 1;
      const optionKeys = Object.keys(state.options);
      if(optionKeys.length > 0) {
        newOptionId = +optionKeys.sort((k1, k2) => k2 - k1)[0] + 1;
      }

      for(let timingId in state.timings) {
        const timing = state.timings[timingId];
        const categoryData = timing.options[categoryId];
        const categoryDataOptions = categoryData.options;
        categoryDataOptions[newOptionId] = true;
      }

      state.options[newOptionId] = {categoryId, name, enabled: true};
    },
    toggleTimingCategoryOptional(state, action) {
      const {timingId, categoryId} = action.payload;
      state.timings[timingId].options[categoryId].optional = !state.timings[timingId].options[categoryId].optional;
    },
    addTiming(state, action) {
      const {start, end} = action.payload;
      const categoryOptions = getCategoryOptions(state.options, state.categories);

      let newTimingId = 1;
      const timingKeys = Object.keys(state.timings);
      if(timingKeys.length > 0) {
        newTimingId = +timingKeys.sort((k1, k2) => k2 - k1)[0] + 1;
      }

      let timingOptions = {};
      for(let categoryId in categoryOptions) {
        let options = {};
        for(let categoryData of categoryOptions[categoryId]) {
          options[categoryData.optionId] = true;
        }

        timingOptions[categoryId] = {enabled: true, options}
      }

      state.timings[newTimingId] = {
        start, end, options: timingOptions
      }

    },
    clearData(state) {
      state.categories = {};
      state.options = {};
      state.timings = {};
    },
    resetData(state) {
      state.categories = defaultData.categories;
      state.options = defaultData.options;
      state.timings = defaultData.timings;
    },
  }
});

export default harpSlice.reducer;
export const harpActions = harpSlice.actions;
