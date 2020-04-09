enum Color {
    Transparent, // 0
    White, // 1 = RGB(255, 255, 255)
    Red, // 2 = RGB(255, 33, 33)
    Pink, // 3 = RGB(255, 147, 196)
    Orange, // 4 = RGB(255, 129, 53)
    Yellow, // 5 = RGB(255, 246, 9)
    Aqua, // 6 = RGB(36, 156, 163)
    BrightGreen, // 7 = RGB(120, 220, 82)
    Blue, // 8 = RGB(0, 63, 173)
    LightBlue, // 9 = RGB(135, 242, 255)
    Purple, // 10 = RGB(142, 46, 196)
    RoseBouquet, // 11 = RGB(164, 131, 159)
    Wine, // 12 = RGB(92, 64, 108)
    Bone, // 13 = RGB(229, 205, 196)
    Brown, // 14 = RGB(145, 70, 61)
    Black // 15 = RGB(0, 0, 0)
}   // enum Color

enum TileType {
    Path,
    Wall,
    FloorHole,
    CeilingHole
}   // enum TileType

enum ScreenStatus {
    None,
    NeedsUpdate,
    Turning,
    Walking
}   // ScreenStatus

interface Screen {
    currImage: number
    images: Image[]
    lastUpdate: number
    nextUpdate: number
    status: ScreenStatus
    turnDelta: number
    turnX: number
}   // interface Screen

const BG_COLOR: number = Color.Black
const MAP: Image = img`
    1 1 1 1 1 1 1 1 1 1
    1 f f 1 f f f f 1 1
    1 1 f f f 1 1 f f 1
    1 1 f 1 f 1 1 1 f 1
    1 f e f f c f f f 1
    1 1 f 1 1 f 1 1 f 1
    1 f 7 1 1 f f f f 1
    1 1 1 1 1 1 1 1 1 1
`
const WALL_COLOR: number = Color.White
const WALL_FILL: number = Color.Wine

const TILE_COLOR_PATH: number = Color.Black
const TILE_COLOR_WALL: number = Color.White
const TILE_COLOR_HOLE_FLOOR: number = Color.Brown
const TILE_COLOR_HOLE_CEILING: number = Color.Wine

const LAYERS_PER_UNIT: number = 4
const TURN_ANIMATION_DURATION: number = 750
const MOVE_ANIMATION_DURATION: number = 1000

let camera: Camera = {
    z: 0.5,
    view: new Viewport(0, 0, 159, 89, 6, true)
}
let player: Player = {
    direction: Direction.North,
    location: { x: 2, y: 6 }
}

let scaleFactors: number[] = null
let layers: Rectangle[] = null
buildLayers()

let currDisplay: Screen = {
    currImage: 0,
    images: [
        image.create(screen.width, screen.height),
        image.create(screen.width, screen.height)
    ],
    lastUpdate: 0,
    nextUpdate: 0,
    status: ScreenStatus.None,
    turnDelta: 0,
    turnX: 0
}
let locImage: Image = image.create(screen.width, 10)
let locSprite: Sprite = sprites.create(locImage)
locSprite.setFlag(SpriteFlag.Ghost, true)
locSprite.y = 5
scene.setBackgroundColor(Color.White)
draw()

controller.A.onEvent(ControllerButtonEvent.Pressed, function () {
    camera.z = 1
    draw()
})

controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
    camera.z = 0.5
    draw()
})

controller.down.onEvent(ControllerButtonEvent.Pressed, function () {
    moveBackward()
})

controller.left.onEvent(ControllerButtonEvent.Pressed, function () {
    turnLeft()
})

controller.menu.onEvent(ControllerButtonEvent.Pressed, function () {
    let msg: string = 'Scale factors:'
    let index: number = 0
    for (let sf of scaleFactors) {
        msg += ' ' + index + '=' + Math.roundWithPrecision(sf, 4)
        index++
    }   // for (sf)
    game.showLongText(msg, DialogLayout.Full)
})

controller.right.onEvent(ControllerButtonEvent.Pressed, function () {
    turnRight()
})

controller.up.onEvent(ControllerButtonEvent.Pressed, function () {
    moveForward()
})

game.onUpdate(function () {
    switch (currDisplay.status) {
        case ScreenStatus.NeedsUpdate:
            if (currDisplay.nextUpdate === 0 || game.runtime() >= currDisplay.nextUpdate) {
                updateScreen()
                currDisplay.status = ScreenStatus.None
            }   // if (! currDisplay.nextUpdate || ...)
            break

        case ScreenStatus.Turning:
            turn()
            if (currDisplay.turnX < camera.view.top.x || currDisplay.turnX > camera.view.bottom.x) {
                draw()
            }   // if (currDisplay.turnX < camera.view.top.x || ...)
            break

        case ScreenStatus.Walking:
            break
    }   // switch (currDisplay.status)
})

function buildLayers(): void {
    layers = []
    buildScaleFactors()
    for (let index: number = -LAYERS_PER_UNIT; index < camera.view.depth * LAYERS_PER_UNIT; index++) {
        // Negative indices are bad :-)
        // Shift index
        let sf: number = scaleFactors[index + LAYERS_PER_UNIT]
        let delta: Size = {
            height: camera.view.height / 2 * sf,
            width: camera.view.width / 2 * sf
        }
        // Negative indices are bad :-)
        // Shift index
        layers[index + LAYERS_PER_UNIT] = {
            top: {
                x: Math.floor(camera.view.center.x - delta.width),
                y: Math.floor(camera.view.center.y - delta.height)
            }, bottom: {
                x: Math.floor(camera.view.center.x + delta.width),
                y: Math.floor(camera.view.center.y + delta.height)
            }
        }
    }   // for (index)
}   // buildLayers()


// Reference data points:
//  z  scale factor
// --  ------------
//  0  1
//  1  0.7
//  2  0.45
//  3  0.275
//  4  0.15
//  5  0.05
//
// Polynomial regression (degree 2): sf = 0.02679z^2 - 0.3218z + 0.9964
// R^2 = 0.9995
//
// Polynomial regression (degree 4): sf = -0.001042z^4 + 0.008565z^3 + 0.008681z^2 - 0.3174z + 1.0001984
// R^2 = 0.99998
function buildScaleFactors(): void {
    scaleFactors = []
    for (let index: number = -LAYERS_PER_UNIT; index < camera.view.depth * LAYERS_PER_UNIT; index++) {
        // Negative indices are bad :-)
        // Shift index
        scaleFactors[index + LAYERS_PER_UNIT] =
            index === 0
                ? 1
                :
                /*
                0.02679 * (index / LAYERS_PER_UNIT) ** 2 -
                0.3218 * index / LAYERS_PER_UNIT +
                0.9964
                */
                -0.001042 * (index / LAYERS_PER_UNIT) ** 4 +
                0.008565 * (index / LAYERS_PER_UNIT) ** 3 +
                0.008681 * (index / LAYERS_PER_UNIT) ** 2 -
                0.3174 * index / LAYERS_PER_UNIT +
                1.0001984
    }   // for (index)
}   // buildScaleFactors()

function draw(): void {
    let bgIndex: number = 1 - currDisplay.currImage
    let bg: Image = currDisplay.images[bgIndex]
    bg.fill(BG_COLOR)
    let canSee: boolean = true
    let frontWalls: TileType[] = []
    let leftWalls: boolean[] = []
    let rightWalls: boolean[] = []
    let deltaX: number = 0
    let deltaY: number = 0
    let currX: number = player.location.x
    let currY: number = player.location.y
    let floodPoints: Point[] = []
    let hole: Hole = null

    switch (player.direction) {
        case Direction.East:
            deltaX = 1
            break

        case Direction.North:
            deltaY = -1
            break

        case Direction.South:
            deltaY = 1
            break

        case Direction.West:
            deltaX = -1
            break
    }   // switch (player.direction)

    for (let index: number = 0; index <= camera.view.depth; index++) {
        switch (getMapPixel(currX, currY)) {
            case TILE_COLOR_WALL:
                frontWalls.push(TileType.Wall)
                break

            case TILE_COLOR_HOLE_CEILING:
                frontWalls.push(TileType.CeilingHole)
                break

            case TILE_COLOR_HOLE_FLOOR:
                frontWalls.push(TileType.FloorHole)
                break

            default:
                frontWalls.push(TileType.Path)
                break
        }   // switch (frontTile)
        leftWalls.push(getMapPixel(currX + deltaY, currY - deltaX) === TILE_COLOR_WALL)
        rightWalls.push(getMapPixel(currX - deltaY, currY + deltaX) === TILE_COLOR_WALL)
        currX += deltaX
        currY += deltaY
        /*
        game.showLongText('index: ' + index +
            ' front wall: ' + frontWalls[index] +
            ' left wall: ' + leftWalls[index] +
            ' right wall: ' + rightWalls[index]
            , DialogLayout.Full)
            */
    }   // for (index)

    /*
    let message: string = 'Front walls'
    for (let index: number = 0; index < camera.view.depth; index++) {
        message += ' ' + index + ' ' + frontWalls[index] + ','
    }
    game.showLongText(message, DialogLayout.Full)
    */

    for (let index: number = 0; index <= camera.view.depth; index++) {
        // game.splash("index: " + index)
        if (canSee) {
            // game.splash("A")
            // Negative indices are bad :-)
            // Shift indices
            let frontLayerIndex: number = (camera.z + index - 1) * LAYERS_PER_UNIT + LAYERS_PER_UNIT
            let backLayerIndex: number = frontLayerIndex + LAYERS_PER_UNIT
            // game.showLongText("Index: " + index + " Front layer: " + frontLayerIndex +
            //     ", Back layer: " + backLayerIndex, DialogLayout.Center)
            let frontPlane: Rectangle =
                frontLayerIndex >= layers.length
                    ? {
                        top: { x: camera.view.center.x, y: camera.view.center.y },
                        bottom: { x: camera.view.center.x, y: camera.view.center.y }
                    }
                    : layers[frontLayerIndex]
            let backPlane: Rectangle =
                backLayerIndex >= layers.length
                    ? {
                        top: { x: camera.view.center.x, y: camera.view.center.y },
                        bottom: { x: camera.view.center.x, y: camera.view.center.y }
                    }
                    : layers[backLayerIndex]
            // game.splash("Front plane top x: " + frontPlane.top.x +
            //     " Back plane top x: " + backPlane.top.x)
            // game.splash("B")

            // Check for a wall in front of us
            if (index + 1 < frontWalls.length && frontWalls[index + 1] === TileType.Wall) {
                canSee = false // Don't render any further layers
                bg.drawRect(
                    backPlane.top.x, backPlane.top.y,
                    backPlane.bottom.x - backPlane.top.x + 1,
                    backPlane.bottom.y - backPlane.top.y + 1,
                    WALL_COLOR)
                if (
                    backPlane.bottom.x - backPlane.top.x + 1 > 1 &&
                    backPlane.bottom.y - backPlane.top.y + 1 > 1
                ) {
                    floodPoints.push({ x: backPlane.top.x + 1, y: backPlane.top.y + 1 })
                    // bg.setPixel(backPlane.top.x + 1, backPlane.top.y + 1, Color.Yellow)
                }   // if (backPlane.top.x - ...)
            }   // if (frontWalls[index + 1] === TileType.Wall)

            switch (frontWalls[index]) {
                case TileType.CeilingHole:
                    hole = new Hole(layers[backLayerIndex - 1], layers[frontLayerIndex + 1])
                    hole.drawCeilingHole(bg, WALL_COLOR)
                    break

                case TileType.FloorHole:
                    hole = new Hole(layers[backLayerIndex - 1], layers[frontLayerIndex + 1])
                    hole.drawFloorHole(bg, WALL_COLOR)
                    break
            }   // switch (frontWalls[index])

            // game.splash("C")
            if (leftWalls[index]) {
                if (index > 0) {
                    bg.drawLine(frontPlane.top.x, frontPlane.top.y,
                        frontPlane.top.x, frontPlane.bottom.y, WALL_COLOR)
                }   // if (index)
                bg.drawLine(frontPlane.top.x, frontPlane.top.y,
                    backPlane.top.x, backPlane.top.y, WALL_COLOR)
                bg.drawLine(frontPlane.top.x, frontPlane.bottom.y,
                    backPlane.top.x, backPlane.bottom.y, WALL_COLOR)
                bg.drawLine(backPlane.top.x, backPlane.top.y,
                    backPlane.top.x, backPlane.bottom.y, WALL_COLOR)
            } else {
                bg.drawLine(backPlane.top.x, backPlane.top.y,
                    frontPlane.top.x, backPlane.top.y, WALL_COLOR)
                bg.drawLine(backPlane.top.x, backPlane.bottom.y,
                    frontPlane.top.x, backPlane.bottom.y, WALL_COLOR)
                // TODO: Fill the rectangle instead of using flood points
            }   // if (leftWalls[index])

            // game.splash("D")
            if (rightWalls[index]) {
                if (index > 0) {
                    bg.drawLine(frontPlane.bottom.x, frontPlane.top.y,
                        frontPlane.bottom.x, frontPlane.bottom.y, WALL_COLOR)
                }   // if (index)
                bg.drawLine(frontPlane.bottom.x, frontPlane.top.y,
                    backPlane.bottom.x, backPlane.top.y, WALL_COLOR)
                bg.drawLine(frontPlane.bottom.x, frontPlane.bottom.y,
                    backPlane.bottom.x, backPlane.bottom.y, WALL_COLOR)
                bg.drawLine(backPlane.bottom.x, backPlane.top.y,
                    backPlane.bottom.x, backPlane.bottom.y, WALL_COLOR)
            } else {
                bg.drawLine(backPlane.bottom.x, backPlane.top.y,
                    frontPlane.bottom.x, backPlane.top.y, WALL_COLOR)
                bg.drawLine(backPlane.bottom.x, backPlane.bottom.y,
                    frontPlane.bottom.x, backPlane.bottom.y, WALL_COLOR)
            }   // if (rightWalls[index])

            if (
                backPlane.top.x - frontPlane.top.x > 1 &&
                backPlane.bottom.y - backPlane.top.y > 1
            ) {
                floodPoints.push({ x: backPlane.top.x - 1, y: backPlane.top.y + 1 })
                floodPoints.push({ x: backPlane.bottom.x + 1, y: backPlane.top.y + 1 })
                // bg.setPixel(backPlane.top.x - 1, backPlane.top.y + 1, Color.Yellow)
                // bg.setPixel(backPlane.bottom.x + 1, backPlane.top.y + 1, Color.Yellow)
            }   // if (frontPlane.top.x - ...)
        }   // if (canSee)
        // scene.setBackgroundImage(bg)
        // pause(1000)
    }   // for (index)

    if (WALL_FILL > 0) {
        for (let fp of floodPoints) {
            // FloodImage.flood(bg, fp.x, fp.y, WALL_FILL)
            floodScanline(bg, fp.x, fp.y, WALL_FILL)
        }   // for (fp)
    }   // if (WALL_FILL)

    // Crop viewport
    if (camera.view.top.x > 0) {
        bg.fillRect(0, 0, screen.width, camera.view.top.x, Color.Transparent)
    }   // if (camera.view.top.x)
    if (camera.view.top.y > 0) {
        bg.fillRect(0, 0, camera.view.top.y, screen.height, Color.Transparent)
    }   // if (camera.view.top.y)
    if (camera.view.bottom.x < screen.width - 1) {
        bg.fillRect(camera.view.bottom.x + 1, 0, screen.width - camera.view.bottom.x, screen.height, Color.Transparent)
    }   // if (camera.view.bottom.x)
    if (camera.view.bottom.y < screen.height - 1) {
        bg.fillRect(0, camera.view.bottom.y + 1, screen.width, screen.height - camera.view.bottom.y, Color.Transparent)
    }   // if (camera.view.bottom.y)

    let location: string = 'Player @ (' + player.location.x +
        ',' + player.location.y +
        ') dir: '
    switch (player.direction) {
        case Direction.East:
            location += 'E'
            break

        case Direction.North:
            location += 'N'
            break

        case Direction.South:
            location += 'S'
            break

        case Direction.West:
            location += 'W'
            break
    }   // switch (player.direction)
    locImage.fill(Color.Transparent)
    locImage.printCenter(location, 0, 5, image.font5)
    currDisplay.currImage = bgIndex
    currDisplay.status = ScreenStatus.NeedsUpdate
}   // draw()

function getMapPixel(x: number, y: number): number {
    if (x < 0 || y < 0) {
        return 1
    }   // if (! x || ! y)
    if (x >= MAP.width || y >= MAP.height) {
        return 1
    }
    return MAP.getPixel(x, y)
}   // getMapPixel()

function move(deltaX: number, deltaY: number): void {
    if (getMapPixel(player.location.x + deltaX, player.location.y + deltaY) !== 1) {
        player.location.x += deltaX
        player.location.y += deltaY
    } else {
        music.wawawawaa.play()
    }   // if (getMapPixel(...))
    draw()
    currDisplay.nextUpdate = game.runtime() + MOVE_ANIMATION_DURATION
}   // move()

function moveBackward(): void {
    if (currDisplay.status === ScreenStatus.None) {
        camera.z = 1
        draw()
        updateScreen()
        camera.z = 0.5
        switch (player.direction) {
            case Direction.North:
                move(0, 1)
                break

            case Direction.South:
                move(0, -1)
                break

            case Direction.East:
                move(-1, 0)
                break

            case Direction.West:
                move(1, 0)
                break
        }   // switch (player.direction)
    }   // if (! player.moving)
}   // moveBackward()

function moveForward(): void {
    if (currDisplay.status === ScreenStatus.None) {
        camera.z = 0
        draw()
        updateScreen()
        camera.z = 0.5
        switch (player.direction) {
            case Direction.North:
                move(0, -1)
                break

            case Direction.South:
                move(0, 1)
                break

            case Direction.East:
                move(1, 0)
                break

            case Direction.West:
                move(-1, 0)
                break
        }   // switch (player.direction)
    }   // if (! player.moving)
}   // moveForward()

function turnLeft(): void {
    if (currDisplay.status === ScreenStatus.None) {
        currDisplay.turnDelta = 1
        currDisplay.turnX = 0
        currDisplay.lastUpdate = game.runtime()
        currDisplay.status = ScreenStatus.Turning
        player.direction--
        if (player.direction < Direction.North) {
            player.direction = Direction.West
        }   // if (! player.direction)
        // game.splash("direction: " + player.direction)
    }   // if (! player.moving)
}   // turnLeft()

function turnRight(): void {
    if (currDisplay.status === ScreenStatus.None) {
        currDisplay.turnDelta = -1
        currDisplay.turnX = camera.view.bottom.x - 1
        currDisplay.lastUpdate = game.runtime()
        currDisplay.status = ScreenStatus.Turning
        player.direction++
        if (player.direction > Direction.West) {
            player.direction = Direction.North
        }   // if (player.direction > Direction.West)
        // game.splash("direction: " + player.direction)
    }   // if (! player.moving)
}   // turnRight()

function turn(): void {
    let bgIndex: number = 1 - currDisplay.currImage
    let bg: Image = currDisplay.images[bgIndex]
    bg.fill(Color.Transparent)
    bg.fillRect(camera.view.top.x, camera.view.top.y,
        camera.view.bottom.x - camera.view.top.x + 1,
        camera.view.bottom.y - camera.view.top.y + 1, BG_COLOR)
    let backPlane: Rectangle = layers[camera.z * LAYERS_PER_UNIT + LAYERS_PER_UNIT]
    bg.drawLine(camera.view.top.x, backPlane.top.y, camera.view.bottom.x, backPlane.top.y, WALL_COLOR)
    bg.drawLine(camera.view.top.x, backPlane.bottom.y, camera.view.bottom.x, backPlane.bottom.y, WALL_COLOR)
    let delta: number = currDisplay.turnDelta * camera.view.width * (game.runtime() - currDisplay.lastUpdate) / TURN_ANIMATION_DURATION
    let x: number =
        currDisplay.turnX + delta
    bg.drawLine(x,
        backPlane.top.y + 1,
        x, backPlane.bottom.y - 1,
        WALL_COLOR)
    currDisplay.turnX = x
    currDisplay.currImage = bgIndex
    currDisplay.nextUpdate = 0
    updateScreen()
}   // turnAnimation()

function updateScreen(): void {
    scene.setBackgroundImage(currDisplay.images[currDisplay.currImage])
    currDisplay.lastUpdate = game.runtime()
}   // updateScreen()