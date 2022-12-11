
// import { storageService } from './async-storage.service.js'
import { httpService } from './http.service.js'
import { colorService, colors } from './color.service.js'
import { utilService } from './util.service.js'
import { userService } from './user.service.js'
import { socketService } from './socket.service.js'

export const cmps = ['status', 'priority', 'person', 'date', 'timeline', 'numbers', 'text', 'link',]

const BOARD_URL = 'board/'

export const boardService = {
    query,
    filterBoard,
    save,
    remove,
    getEmptyBoard,
    removeManyTasks,
    loadFromSessionStorage,
    queryKanban,
    saveToSessionStorage,
    getDashboardData
}

window.cs = boardService

function loadFromSessionStorage(key) {
    return sessionStorage.getItem(key)
}

function saveToSessionStorage(key, state) {
    sessionStorage.setItem(key, state)
}

async function query(id = '') {
    return await httpService.get(BOARD_URL + id)
}

async function remove(boardId) {
    return await httpService.delete(BOARD_URL + boardId)
}

async function removeManyTasks(taskIds, boardId) {
    const data = { boardId, taskIds }
    const board = await httpService.delete(BOARD_URL, data)
    const loggedinUser = await userService.getLoggedinUser()
    socketService.emit('save-board', { board, loggedinUser })
    return board

}

async function save(board) {
    var savedBoard
    if (board._id) {
        savedBoard = await httpService.put(BOARD_URL + board._id, board)
    } else {
        savedBoard = await httpService.post(BOARD_URL, board)
    }
    const loggedinUser =await userService.getLoggedinUser()
    socketService.emit('save-board', { savedBoard, loggedinUser })
    return savedBoard
}

function queryKanban(storeBoard, type = 'status', dataMap) {
    const board = JSON.parse(JSON.stringify(storeBoard))
    board.kanbanType = type
    if (type === 'groupTitle') return board
    if (!board.kanbanOrder) board.kanbanOrder = JSON.parse(JSON.stringify(dataMap.tasks))
    board.groups = board.kanbanOrder[type].reduce((groups, val) => {
        const tasks = _getTasksByValue(board, type, val)
        if (!tasks.length) return groups
        const group = { tasks }
        group.title = type === 'status' || type === 'priority'
            ? colorService.getLabelById(type, val).title
            : val
        group.color = type === 'status' || type === 'priority'
            ? colorService.getLabelById(type, val).value
            : ''
        group._id = type === 'status' || type === 'priority'
            ? colorService.getLabelById(type, val)._id
            : utilService.makeId()
        groups.push(group)
        return groups
    }, [])

    const taskOrder = board.taskIdOrder
        ? board.taskIdOrder[type]
            ? board.taskIdOrder[type]
            : {}
        : {}
    board.groups.forEach(group => {
        if (taskOrder[group._id]?.length) {
            const tasks = []
            taskOrder[group._id].forEach(id => {
                const idx = group.tasks.findIndex(task => task._id === id)
                if (idx !== -1) tasks.push(group.tasks[idx])
            })
            group.tasks = tasks
        } else {
            taskOrder[group._id] = group.tasks.map(task => task._id)
        }
    })

    if (!board.taskIdOrder) board.taskIdOrder = { [type]: taskOrder }
    const boardToSave = JSON.parse(JSON.stringify(storeBoard))
    boardToSave.kanbanOrder = board.kanbanOrder
    boardToSave.taskIdOrder = board.taskIdOrder
    save(boardToSave)
    return board
}

function filterBoard(board, filter) {
    var boardCopy = JSON.parse(JSON.stringify(board))
    if (filter.groupTitle || filter.tasks) boardCopy = _multiFilter(filter, boardCopy)
    if (filter.userId) boardCopy = _filterByPerson(boardCopy, filter.userId)
    if (filter.txt) boardCopy = _filterByTxt(boardCopy, filter.txt)
    return boardCopy
}

async function getEmptyBoard() {
    const color1 = await colorService.randomColor('group')
    const color2 = await colorService.randomColor('group')
    const loggedinUser = await userService.getLoggedinUser()
    const { _id, fullname } = loggedinUser
    const board = {
        title: 'New Board',
        archivedAt: Date.now(),
        createdBy: { _id, fullname },
        groups: [
            {
                _id: utilService.makeId(),
                title: 'Group Title',
                style: {
                    color: color1,
                    light: color1 + '99'
                },
                tasks: [
                    {
                        _id: utilService.makeId(),
                        title: 'Item 1',
                        status: 'dfbyc',
                        date: Date.now() + 24 * 60 * 60 * 1000,
                        comments: []
                    },
                    {
                        _id: utilService.makeId(),
                        title: 'Item 2',
                        status: 'qwdlk',
                        date: Date.now() - 24 * 60 * 60 * 1000,
                        comments: []
                    },
                    {
                        _id: utilService.makeId(),
                        title: 'Item 3',
                        date: Date.now() - 24 * 60 * 60 * 1000,
                        comments: []
                    }
                ]

            },
            {
                _id: utilService.makeId(),
                title: 'Group Title',
                style: {
                    color: color2,
                    light: color2 + '99'
                },
                tasks: [
                    {
                        _id: utilService.makeId(),
                        title: 'Item 4',
                        date: Date.now() - 24 * 60 * 60 * 1000,
                        comments: []
                    },
                    {
                        _id: utilService.makeId(),
                        title: 'Item 5',
                        date: Date.now() - 3 * 24 * 60 * 60 * 1000,
                        comments: []
                    }
                ]
            }
        ],
        cmpsOrder: ['status', 'date']
    }
    const boardData = await httpService.post(BOARD_URL, board)
    socketService.emit('add-board', { boardData, loggedinUser })
    return boardData

}

function getDashboardData(board) {
    if (!board._id) return {}
    const data = {
        person: {},
        group: {},
        priority: {},
        status: {}
    }
    if (board.members?.length) board.members.forEach(member => {
        if (!data.person[member._id]) data.person[member._id] = {
            total: 0
        }
    })
    if (board.groups?.length) board.groups.forEach(group => {
        if (!data.group[group._id]) data.group[group._id] = {
            total: 0,
            status: {},
            priority: {}
        }
    })
    colors().status.forEach(status => data.status[status._id] = 0)
    colors().priority.forEach(priority => data.priority[priority._id] = 0)
    board.groups.forEach(group => {
        data.group[group._id].total += group.tasks.length
        group.tasks.forEach(task => {
            if (task.status) {
                if (!data.group[group._id].status[task.status]) data.group[group._id].status[task.status] = 0
                data.status[task.status]++
                data.group[group._id].status[task.status]++
            }
            if (task.priority) {
                if (!data.group[group._id].priority[task.priority]) data.group[group._id].priority[task.priority] = 0
                data.priority[task.priority]++
                data.group[group._id].priority[task.priority]++
            }
            task.person?.forEach(person => {
                data.person[person._id].total++
                if (task.status) {
                    if (!data.person[person._id].status) data.person[person._id].status = {}
                    if (!data.person[person._id].status[task.status]) data.person[person._id].status[task.status] = 0
                    data.person[person._id].status[task.status]++
                }
                if (task.priority) {
                    if (!data.person[person._id].priority) data.person[person._id].priority = {}
                    if (!data.person[person._id].priority[task.priority]) data.person[person._id].priority[task.priority] = 0
                    data.person[person._id].priority[task.priority]++
                }
            })
        })
    })
    return data
}

function _filterByPerson(board, id) {
    if (!id) return board
    board.groups = board.groups.filter(group => {
        if (!group.tasks || !group.tasks.length) return false
        group.tasks = group.tasks.filter(task => {
            return task?.person?.some(person => person._id === id)
        })
        return (group.tasks && group.tasks.length)
    })
    return board
}

function _filterByTxt(board, txt) {
    if (!txt) return board
    const regex = new RegExp(txt, 'ig')
    board.groups = board.groups.reduce((groupArr, group) => {
        const isGroupTitleMatch = regex.test(group.title)
        if (isGroupTitleMatch) {
            group.title = group.title.replaceAll(regex, match => `<span class="highlight">${match}</span>`)
        }

        group.tasks = group.tasks.reduce((taskArr, task) => {
            if (regex.test(task.title)) {
                task.title = task.title.replaceAll(regex, match => `<span class="highlight">${match}</span>`)
                taskArr.push(task)
            }
            return taskArr
        }, [])

        if (group.tasks?.length || isGroupTitleMatch) groupArr.push(group)
        return groupArr

    }, [])
    return board
}
function _multiFilter(filterBy, board) {

    // Itereting through board groups
    board.groups = board.groups.reduce((filteredGroups, group) => {

        // Checking if group title filter exsists, and if group matches it
        if (filterBy?.groupTitle?.length &&
            !filterBy.groupTitle.find(title => title === group.title)) return filteredGroups

        // Checking if filter contains task parameteres
        if (!filterBy.tasks) {
            filteredGroups.push(group)
            return filteredGroups
        }
        group.tasks = group.tasks.filter(task => {

            // Making filter deep copy before manipulating it
            const taskFilter = JSON.parse(JSON.stringify(filterBy.tasks))

            // Special check for user filter
            if (taskFilter.person?.length &&
                !taskFilter.person.some(id => {
                    return (task.person && task.person.find(person => person._id === id))
                })) return false

            // Than deleting user filter
            delete taskFilter.person

            // Filtering rest of parameters
            for (let prop in taskFilter) {
                if (!taskFilter[prop].length || taskFilter[prop].find(val => task[prop] === val)) return true
            }
        })

        // Making sure group has tasks
        if (group.tasks.length) filteredGroups.push(group)
        return filteredGroups

    }, [])

    return board
}

// function _multiFilter(filterBy, board) {
//     // create a Set for faster lookup of groupTitle and person IDs
//     const groupTitleSet = new Set(filterBy?.groupTitle || [])
//     const personIdSet = new Set(filterBy?.tasks?.person || [])
//     // filter the groups and tasks in-place, to avoid creating new arrays
//     board.groups = board.groups.filter(group => {
//         if (!groupTitleSet.has(group.title)) return false
//         if (!filterBy.tasks) return true
//         group.tasks = group.tasks.filter(task => {
//             if (personIdSet.size > 0 && !personIdSet.has(task.person?._id)) return false
//             const taskFilter = JSON.parse(JSON.stringify(filterBy.tasks))
//             delete taskFilter.person
//             for (let prop in taskFilter) {
//                 if (!taskFilter[prop].length || taskFilter[prop].find(val => task[prop] === val)) {
//                     return true
//                 }
//             }
//             return false
//         })
//         return group.tasks.length > 0
//     })
//     return board
// }

function _getTasksByValue(board, key, value) {
    if (!board || !key || !value) return null
    return board.groups.reduce((tasks, group) => {
        const filteredGroupTasks = group.tasks.filter(task => key === 'person'
            ? task.person.find(person => person._id === value)
            : task[key] === value
        )
        if (filteredGroupTasks.length) tasks.push(...filteredGroupTasks)
        return tasks
    }, [])
}