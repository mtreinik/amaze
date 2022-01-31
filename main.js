const width = 20
const height = 20
const FONT_SIZE = 32

let canvas, ctx
let mapWidth, mapHeight
let animationHandle = null
let redraw = true
let map = []

const EMPTY = 0b00000
const NORTH = 1 << 0
const NORTHEAST = 1 << 1
const EAST = 1 << 2
const SOUTHEAST = 1 << 3
const SOUTH = 1 << 4
const SOUTHWEST = 1 << 5
const WEST = 1 << 6
const NORTHWEST = 1 << 7
const HOUSE = 1 << 8
const ERROR = 1 << 9

const ROAD_BITS = (NORTH | NORTHEAST | EAST | SOUTHEAST | SOUTH | SOUTHWEST | WEST | NORTHWEST)
const NORTHBITS = (NORTH | NORTHEAST | NORTHWEST)
const EASTBITS = (NORTHEAST | EAST | SOUTHEAST)
const SOUTHBITS = (SOUTHEAST | SOUTH | SOUTHWEST)
const WESTBITS = (SOUTHWEST | WEST | NORTHWEST)

const ERROR_COLOR = '#FF8000'
const HOUSE_COLOR = '#505050'
const ROAD_COLOR = '#995530'

const origReplacements = [
  {
    from: [[EMPTY, NORTH | SOUTH]],
    to: [[EAST, NORTH | WEST | SOUTH]]
  },
  {
    from: [[EMPTY, EAST]],
    to: [[EAST, EAST | WEST]]
  },
  {
    from: [[EMPTY, SOUTH]],
    to: [[EAST, SOUTHWEST]]
  },
  {
    from: [[EMPTY, NORTH]],
    to: [[EAST, NORTHWEST]]
  },
  {
    from: [[EMPTY, NORTH | SOUTH], [EMPTY, NORTH | SOUTH]],
    to: [[SOUTHEAST, NORTHWEST], [NORTHEAST, SOUTHWEST]]
  },
  {
    from: [[EMPTY, SOUTHEAST], [EMPTY, NORTHEAST]],
    to: [[SOUTHEAST, EAST | WEST], [NORTHEAST, EAST | WEST]]
  },
  {
    from: [[EMPTY, NORTH | SOUTH], [EMPTY, NORTHEAST]],
    to: [[SOUTHEAST, NORTHWEST], [NORTHEAST, EAST | WEST]]
  },
  {
    from: [[EMPTY, SOUTHEAST], [EMPTY, NORTH | SOUTH]],
    to: [[SOUTHEAST, EAST | WEST], [NORTHEAST, SOUTHWEST]]
  }
  // ,
  // {
  //   from: [[EMPTY, NORTH | SOUTH], [EMPTY, NORTH | SOUTH]],
  //   to: [[HOUSE | EAST, NORTH | SOUTH | WEST], [EMPTY, NORTH | SOUTH]]
  // }
]

const rot = (times) => (r) => {
  return {
    from: rotate(r.from, times), to: rotate(r.to, times)
  }
}

const replacements = origReplacements
  .concat(origReplacements.map(rot(1)))
  .concat(origReplacements.map(rot(2)))
  .concat(origReplacements.map(rot(3)))

const players = [
  {
    number: 0,
    name: 'Player1',
    color: 'purple',
    x: 5,
    y: 5,
    piece: replacements[5]
  },
  {
    number: 1,
    name: 'Player2',
    color: 'yellow',
    x: 12,
    y: 5,
    piece: replacements[0]
  }
]

function hasBits(number, mask) {
  return (number & mask) === mask
}

function hasDifferentBits(x, y, tile1, bits1, tile2, bits2) {
  const result = ((tile1 & bits1) && !(tile2 & bits2))
    || (!(tile1 & bits1) && (tile2 & bits2))
  if (result) {
    drawBlock(x, y, ERROR, 'red')
  }
  return result
}

function isFit(map, tile, atX, atY) {
  const tileWidth = tile[0].length
  const tileHeight = tile.length
  let result = true
  for (let x = 0; x < tileWidth; x++) {
    if (hasDifferentBits(atX + x, atY - 1, tile[0][x], NORTHBITS, map[atY - 1][atX + x], SOUTHBITS)) {
      result = false
    }
    if (hasDifferentBits(atX + x, atY + tileHeight, tile[tileHeight - 1][x], SOUTHBITS, map[atY + tileHeight][atX + x], NORTHBITS)) {
      result = false
    }
  }
  for (let y = 0; y < tileHeight; y++) {
    if (hasDifferentBits(atX + tileWidth, atY + y, tile[y][tileWidth - 1], EASTBITS, map[atY + y][atX + tileWidth], WESTBITS)) {
      result = false
    }
    if (hasDifferentBits(atX - 1, atY + y, tile[y][0], WESTBITS, map[atY + y][atX - 1], EASTBITS)) {
      result = false
    }
  }
  return result
}

function isMatch(map, tile, atX, atY) {
  const tileWidth = tile[0].length
  const tileHeight = tile.length
  for (let y = 0; y < tileHeight; y++) {
    for (let x = 0; x < tileWidth; x++) {
      if (map[atY + y][atX + x] !== tile[y][x]) {
        return false
      }
    }
  }
  return true
}

function line(ctx, x, y, dx, dy) {
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + dx, y + dy)
  ctx.stroke()
}

function arc(ctx, x, y, radius, startAngle, endAngle, anticlockwise) {
  ctx.beginPath()
  ctx.arc(x, y, radius, startAngle, endAngle, anticlockwise)
  ctx.stroke()

}

function drawTileFrame(x, y, tile, frameColor, lineWidth) {
  const dx = mapWidth / width
  const dy = mapHeight / height
  const startX = x * dx
  const startY = y * dy
  const tileWidth = tile[0].length
  const tileHeight = tile.length

  ctx.lineWidth = lineWidth || 3
  ctx.strokeStyle = frameColor
  ctx.strokeRect(startX, startY, dx * tileWidth, dy * tileHeight)
}

function drawBlock(x, y, color, roadColor, frameColor) {
  const dx = mapWidth / width
  const dy = mapHeight / height
  const startX = x * dx
  const startY = y * dy
  const midX = Math.floor((x + 0.5) * dx)
  const midY = Math.floor((y + 0.5) * dy)

  // grid
  ctx.lineWidth = 1
  ctx.strokeStyle = '#000000'

  ctx.strokeRect(startX, startY, dx, dy)

  // roads
  ctx.lineWidth = dx / 6
  ctx.strokeStyle = roadColor || ROAD_COLOR

  if (hasBits(color, NORTH)) {
    line(ctx, startX + dx / 2, startY, 0, dy / 2)
  }
  if (hasBits(color, EAST)) {
    line(ctx, midX, startY + dy / 2, dx / 2, 0)
  }
  if (hasBits(color, SOUTH)) {
    line(ctx, startX + dx / 2, midY, 0, dy / 2)
  }
  if (hasBits(color, WEST)) {
    line(ctx, startX, startY + dy / 2, dx / 2, 0)
  }

  if (hasBits(color, SOUTHWEST)) {
    arc(ctx, startX, startY + dy, dy / 2, 0, -Math.PI / 2, true)
  }
  if (hasBits(color, SOUTHEAST)) {
    arc(ctx, startX + dx, startY + dy, dy / 2, -Math.PI / 2, -Math.PI, true)
  }
  if (hasBits(color, NORTHWEST)) {
    arc(ctx, startX, startY, dy / 2, Math.PI / 2, 0, true)
  }
  if (hasBits(color, NORTHEAST)) {
    arc(ctx, startX + dx, startY, dy / 2, Math.PI, Math.PI / 2, true)
  }

  // house
  if (hasBits(color, HOUSE)) {
    ctx.fillStyle = HOUSE_COLOR
    ctx.fillRect(midX - dx / 4, midY - dy / 4, dx / 2, dy / 2)
  }

  if (hasBits(color, ERROR)) {
    ctx.lineWidth = dx / 20
    ctx.strokeStyle = ERROR_COLOR
    line(ctx, midX - dx / 4, midY - dy / 4, dx / 2, dy / 2)
    line(ctx, midX + dx / 4, midY - dy / 4, -dx / 2, dy / 2)
  }


  // frame
  if (frameColor) {
    ctx.lineWidth = 3
    ctx.strokeStyle = frameColor
    ctx.strokeRect(startX, startY, dx, dy)
  }
}

function drawMap(map) {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      drawBlock(x, y, map[y][x])
    }
  }
}

function updateMap(map, tile, atX, atY) {
  for (let y = 0; y < tile.length; y++) {
    for (let x = 0; x < tile[0].length; x++) {
      map[atY + y][atX + x] = tile[y][x]
    }
  }
}

function rotateRoadBits(bits) {
  const houseBit = bits & HOUSE
  const roadBits = bits & ROAD_BITS
  const lowRoadBits = roadBits & 0b11
  const newRoadBits = ((roadBits - lowRoadBits) >> 2) + (lowRoadBits << 6)
  const newBits = houseBit | newRoadBits
  return newBits
}

function rotate(tile, times) {
  if (times > 0) {
    return rotate(rotateOnce(tile), times - 1)
  } else {
    return tile
  }
}

function rotateOnce(tile) {
  const tileWidth = tile[0].length
  const tileHeight = tile.length
  const newTile = []
  for (let x = 0; x < tileWidth; x++) {
    const newRow = []
    for (let y = 0; y < tileHeight; y++) {
      const newBits = rotateRoadBits(tile[y][tileWidth - 1 - x])
      newRow.push(newBits)
    }
    newTile.push(newRow)
  }
  return newTile
}

function drawPlayerPiece(startX, startY, piece, color) {
  const tileHeight = piece.length
  const tileWidth = piece[0].length
  for (let y = 0; y < tileHeight; y++) {
    for (let x = 0; x < tileWidth; x++) {
      drawBlock(startX + x, startY + y, piece[y][x], color)
    }
  }
  if (isFit(map, piece, startX, startY)) {
    drawTileFrame(startX, startY, piece, color, 8)
  } else {
    drawTileFrame(startX, startY, piece, color)
  }
}

function placePiece(playerNumber) {
  const player = players[playerNumber]
  if (isFit(map, player.piece.to, player.x, player.y)) {
    updateMap(map, player.piece.to, player.x, player.y)
  } else {
    console.log('piece does not fit')
  }
  redraw = true
}

function drawPlayer(player) {
  const toPiece = player.piece.to
  drawPlayerPiece(player.x, player.y, toPiece, player.color)
}

function updateAnimation() {
  if (redraw) {
    drawMap(map)
    players.forEach(player => drawPlayer(player))
    redraw = false
  }
  animationHandle = window.requestAnimationFrame(updateAnimation)
}

function run() {
  canvas = document.getElementById('canvas')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  mapWidth = Math.min(window.innerWidth, window.innerHeight)
  mapHeight = Math.min(window.innerWidth, window.innerHeight)

  ctx = canvas.getContext('2d')
  ctx.font = FONT_SIZE + 'px Times New Roman'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'

  for (let y = 0; y < height; y++) {
    const row = []
    for (let x = 0; x < width; x++) {
      row.push(EMPTY)
    }
    map.push(row)
  }
  for (let y = 2; y < height - 2; y++) {
    map[y][1] = NORTH | SOUTH
    map[y][width - 2] = NORTH | SOUTH
  }
  map[1][width - 2] = SOUTHWEST
  map[1][1] = HOUSE | SOUTH
  map[1][width - 2] = HOUSE | SOUTH
  map[height - 2][1] = HOUSE | NORTH
  map[height - 2][width - 2] = HOUSE | NORTH

  animationHandle = window.requestAnimationFrame(updateAnimation)
}

function movePlayer(playerNumber, dx, dy) {
  players[playerNumber].x = Math.min(width - 2, Math.max(players[playerNumber].x + dx, 1))
  players[playerNumber].y = Math.min(height - 2, Math.max(players[playerNumber].y + dy, 1))
  redraw = true
}

document.onkeydown = function (e) {
  // console.log('e.key', e.key)
  switch (e.key) {
    case 'w':
      movePlayer(0, 0, -1)
      break
    case 'd':
      movePlayer(0, 1, 0)
      break
    case 's':
      movePlayer(0, 0, 1)
      break
    case 'a':
      movePlayer(0, -1, 0)
      break
    case 'Tab':
      placePiece(0)
      break
    case 'ArrowUp':
      movePlayer(1, 0, -1)
      break
    case 'ArrowRight':
      movePlayer(1, 1, 0)
      break
    case 'ArrowDown':
      movePlayer(1, 0, 1)
      break
    case 'ArrowLeft':
      movePlayer(1, -1, 0)
      break
    case 'Enter':
      placePiece(1)
      break
  }
  if (e.key === 'Tab') {
    e.preventDefault()
  }
}


window.addEventListener('load', () => {
  run()
})
