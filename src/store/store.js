import Vuex from 'vuex'

import { userStore } from './user.store.js'
import { boardStore } from './board.store.js'
import { groupStore } from './group.store.js'
import { taskStore } from './task.store.js'

export const store = Vuex.createStore({
  strict: true,
  modules: {
    userStore,
    boardStore,
    groupStore,
    taskStore,
  },
  state: {
  },
  mutations: {
  },
  actions: {
  }
})
