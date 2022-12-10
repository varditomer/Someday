import { boardService } from '../services/board.service.js'
import { groupService } from '../services/group.service.js'

export const groupStore = {
    state() {
        return {
        }
    },
    mutations: {
    },
    actions: {
        async saveGroup({ dispatch, commit }, { group }) {
            try {
                commit({ type: 'saveGroup', group })
                console.log(`group`, group)
                await groupService.save(group)
                // dispatch({ type: 'queryBoard', id: group.boardId, filter: '' })
                console.log(`success`)
            } catch (err) {
                console.log(`Cannot save group`, err)
            }
        },
        async removeGroup({ commit }, { group }) {
            try {
                commit({ type: 'removeGroup', group })
                await groupService.remove(group)
                console.log(`success`)
            } catch (err) {
                console.log(`Cannot remove group`, err)
            }
        },
        async addGroup({ commit }, { isFifo }) {
            try {
                const { _id } = this.getters.board
                const group = await groupService.add(_id, isFifo)
                commit({ type: 'addGroup', group, isFifo })
                return group
            } catch (err) {
                console.log(`Cannot add group at store`, err)
            }
        },
        async duplicateGroup({ commit }, { group }) {
            try {
                const duplicatedGroup = await groupService.duplicate(group)
                commit({ type: 'addGroup', group: duplicatedGroup, isFifo: true })
                return duplicatedGroup
            } catch (err) {
                console.log(`Cannot duplicate group at store`, err)
            }
        },
        async removeTasks({ commit, getters }) {
            try {
                const taskIds = getters.selectedTasks
                const boardId = this.getters.board._id
                const board = await boardService.removeManyTasks([...taskIds], boardId)
                commit({ type: 'setBoard', boardData: { board } })
            } catch (err) {
                console.log(`Cannot delete many tasks at store`, err)
            }
        }
    },
}