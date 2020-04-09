enum Axis {
    x,
    y,
    z
}   // enum Axes

enum Direction {
    North,
    East,
    South,
    West
}   // enum Direction

interface Camera {
    z: number
    view: Viewport
}   // interface Camera

interface Edge {
    begin: number
    end: number
}   // interface Edge

interface Player {
    direction: Direction
    location: Point
}   // interface Player

interface Rectangle {
    bottom: Point
    top: Point
}   // interface Rectangle

interface Size {
    height: number,
    width: number
}   // interface Size

interface Wireframe {
    vertices: Point3d[]
    edges: Edge[]
}   // interface Mesh

interface Point {
    x: number
    y: number
}   // interface Point

class Hole {
    private static readonly SIZE = 0.75
    private _backDelta: number
    private _backPlane: Rectangle
    private _frontDelta: number
    private _frontPlane: Rectangle

    constructor(backPlane: Rectangle, frontPlane: Rectangle) {
        this._backPlane = backPlane
        this._frontPlane = frontPlane
        if (backPlane != null && frontPlane != null) {
            this._backDelta = (backPlane.bottom.x - backPlane.top.x) * (1 - Hole.SIZE)
            this._frontDelta = (frontPlane.bottom.x - frontPlane.top.x) * (1 - Hole.SIZE)
        }   // if (backPlane && frontPlane)
    }   // constructor()

    public drawCeilingHole(img: Image, color: number): void {
        if (this._backPlane != null && this._frontPlane != null && img != null) {
            this.drawHole(
                img,
                {
                    x: this._backPlane.top.x + this._backDelta,
                    y: this._backPlane.top.y
                },
                {
                    x: this._backPlane.bottom.x - this._backDelta,
                    y: this._backPlane.top.y
                },
                {
                    x: this._frontPlane.top.x + this._frontDelta,
                    y: this._frontPlane.top.y
                },
                {
                    x: this._frontPlane.bottom.x - this._frontDelta,
                    y: this._frontPlane.top.y
                }, color
            )
        }   // if (this._backPlane && this._frontPlane && img)
    }   // drawCeilingHole()

    public drawFloorHole(img: Image, color: number): void {
        if (this._backPlane != null && this._frontPlane != null && img != null) {
            this.drawHole(
                img,
                {
                    x: this._backPlane.top.x + this._backDelta,
                    y: this._backPlane.bottom.y
                },
                {
                    x: this._backPlane.bottom.x - this._backDelta,
                    y: this._backPlane.bottom.y
                },
                {
                    x: this._frontPlane.top.x + this._frontDelta,
                    y: this._frontPlane.bottom.y
                },
                {
                    x: this._frontPlane.bottom.x - this._frontDelta,
                    y: this._frontPlane.bottom.y
                }, color
            )
        }   // if (this._backPlane && this._frontPlane && img)
    }   // drawFloor()

    private drawHole(img: Image, backLeft: Point, backRight: Point, frontLeft: Point, frontRight: Point, color: number): void {
        img.drawLine(backLeft.x, backLeft.y, backRight.x, backRight.y, color)
        if (frontRight.y < screen.height && frontRight.y >= 0) {
            img.drawLine(frontLeft.x, frontLeft.y, frontRight.x, frontRight.y, color)
        }   // if (frontRight.y < screen.height)
        img.drawLine(backLeft.x, backLeft.y, frontLeft.x, frontLeft.y, color)
        img.drawLine(backRight.x, backRight.y, frontRight.x, frontRight.y, color)
        img.drawLine(backRight.x, backRight.y, backRight.x, frontRight.y, color)
        img.drawLine(backLeft.x, backLeft.y, backLeft.x, frontLeft.y, color)
    }   // drawHole()
}   // class Hole

class Point3d {
    private _x: number
    private _y: number
    private _z: number

    constructor(x: number, y: number, z: number) {
        this._x = x
        this._y = y
        this._z = z
    }   // constructor()

    public get x(): number {
        return this._x
    }   // get x()

    public get y(): number {
        return this._y
    }   // get y()

    public get z(): number {
        return this._z
    }   // get z()

    public project(camera: Camera): Point {
        if (this._z - camera.z >= camera.view.depth) {
            return {
                x: screen.width / 2 - 1,
                y: screen.height / 2 - 1
            }
        }
        let normalized: Point = this.normalize()
        let scaled: Point = {
            x: normalized.x * camera.z / this._z,
            y: normalized.y * camera.z / this._z
        }
        let denormalized: Point = Point3d.denormalize(scaled)
        return {
            x: Math.round(denormalized.x),
            y: Math.round(denormalized.y)
        }
    }   // project()

    public rotate(degrees: number, axis: Axis): Point3d {
        let rad: number = degrees * Math.PI / 180
        let cosFactor: number = Math.cos(rad)
        let sinFactor: number = Math.sin(rad)
        let normalized: Point = this.normalize()
        let rotated: Point3d
        switch (axis) {
            case Axis.x:
                rotated = new Point3d(
                    normalized.x,
                    normalized.y * cosFactor - this._z * sinFactor,
                    normalized.y * sinFactor + this._z * cosFactor
                )
                break

            case Axis.y:
                rotated = new Point3d(
                    this._z * sinFactor + normalized.x * cosFactor,
                    normalized.y,
                    this._z * cosFactor - normalized.x * sinFactor
                )
                break

            case Axis.z:
                rotated = new Point3d(
                    normalized.x * cosFactor - normalized.y * sinFactor,
                    normalized.x * sinFactor + normalized.y * cosFactor,
                    this._z
                )
        }   // switch (axis)
        let denormalized: Point = Point3d.denormalize({
            x: rotated.x,
            y: rotated.y
        })
        return new Point3d(
            denormalized.x,
            denormalized.y,
            rotated.z
        )
    }   // rotate()

    private static denormalize(point: Point): Point {
        return {
            x: point.x + screen.width / 2,
            y: screen.height / 2 - point.y
        }
    }   // denormalize()

    private normalize(): Point {
        // Normalize screen coordinates with
        // origin at center
        return {
            x: this._x - screen.width / 2,
            y: screen.height / 2 - this._y
        }
    }   // normalize()
}   // class Point3d

class Viewport {
    private _bottom: Point
    private _center: Point
    private _depth: number
    private _height: number
    private _stretch: boolean
    private _top: Point
    private _width: number

    constructor(x1: number, y1: number, x2: number, y2: number, depth: number, stretch: boolean) {
        this._bottom = {
            x: Math.max(x1, x2),
            y: Math.max(y1, y2)
        }
        this._depth = depth
        this._stretch = stretch
        this._top = {
            x: Math.min(x1, x2),
            y: Math.min(y1, y2)
        }

        if (stretch) {
            this._center = {
                x: Math.round((x1 + x2 + 1) / 2),
                y: Math.round((y1 + y2 + 1) / 2)
            }
            this._height = this._bottom.y - this._top.y + 1
            this._width = this._bottom.x - this._top.x + 1
        } else {
            this._center = {
                x: Math.round(screen.width / 2) - 1,
                y: Math.round(screen.height / 2) - 1
            }
            this._height = screen.height
            this._width = screen.width
        }   // if (stretch)
    }   // constructor()

    public get bottom(): Point {
        return this._bottom
    }   // get bottom()

    public get center(): Point {
        return this._center
    }   // get center()

    public get depth(): number {
        return this._depth
    }   // get depth()

    public get height(): number {
        return this._height
    }   // get height()

    public get stretch(): boolean {
        return this._stretch
    }   // public get stretch()

    public get top(): Point {
        return this._top
    }   // get top()

    public get width(): number {
        return this._width
    }   // get width()
}   // class Viewport

// https://lodev.org/cgtutor/floodfill.html
function floodScanline(img: Image, x: number, y: number, c: number) {
    let bgColor: number = img.getPixel(x, y)
    if (bgColor === c) {
        return
    }   // if (img.getPixel(x, y) === c)

    let x1: number
    let spanAbove: boolean
    let spanBelow: boolean
    let stack: Point[] = [{ x: x, y: y }]
    while (stack.length > 0) {
        let p: Point = stack.pop()
        x1 = p.x
        while (x1 >= 0 && img.getPixel(x1, p.y) === bgColor) {
            x1--
        }   // while (x1 >= 0 ...)
        x1++
        spanAbove = false
        spanBelow = false
        while (x1 < img.width && img.getPixel(x1, p.y) === bgColor) {
            img.setPixel(x1, p.y, c)
            if (!spanAbove && p.y > 0 && img.getPixel(x1, p.y - 1) === bgColor) {
                stack.push({ x: x1, y: p.y - 1 })
                spanAbove = true
            } else if (spanAbove && p.y > 0 && img.getPixel(x1, p.y - 1) !== bgColor) {
                spanAbove = false
            }   // if (! spanAbove ...)

            if (!spanBelow && p.y < img.height - 1 && img.getPixel(x1, p.y + 1) === bgColor) {
                stack.push({ x: x1, y: p.y + 1 })
                spanBelow = true
            } else if (spanBelow && p.y < img.height - 1 && img.getPixel(x1, p.y + 1) !== bgColor) {
                spanBelow = false
            }   // if (! spanBelow ...)
            x1++
        }   // while (x1 < img.width && ...)
        // scene.setBackgroundImage(img)
        // pause(50)
    }   // while (stack)
}   // floodScanline()

// https://www.freebasic.net/forum/viewtopic.php?t=26381
class FloodImage {
    private static _img: Image
    private static _mask: number[]
    private static _direction: number // 1=N, 2=E, 3=S, 4=W
    private static _nowX: number
    private static _nowY: number
    private static _loopDir: number
    private static _loopX: number
    private static _loopY: number
    private static _loopMode: number
    private static _bgColor: number
    private static _color: number

    public static flood(img: Image, x: number, y: number, c: number): void {
        FloodImage._mask = [0, 0, 0, 0, 0, 0, 0, 0]
        FloodImage._direction = 1
        FloodImage._nowX = x
        FloodImage._nowY = y
        FloodImage._bgColor = img.getPixel(x, y)
        FloodImage._img = img
        FloodImage._color = c
        while (true) {
            if (FloodImage._mask[4] === FloodImage._bgColor) {
                // Turn right
                FloodImage._direction = FloodImage._direction % 4 + 1
                FloodImage.setMask()
            }   // if (mask[4] === bgColor)

            if (FloodImage._mask[1] !== FloodImage._bgColor && FloodImage._mask[3] !== FloodImage._bgColor && FloodImage._mask[4] !== FloodImage._bgColor && FloodImage._mask[6] !== FloodImage._bgColor) {
                img.setPixel(FloodImage._nowX, FloodImage._nowY, c)
                break
            }   // if (mask[1] && mask[3] && mask[4] && mask[6])

            if (FloodImage._mask[3] !== FloodImage._bgColor && FloodImage._mask[4] !== FloodImage._bgColor && FloodImage._mask[6] !== FloodImage._bgColor) {
                FloodImage.fillAndStep()
            } else if (FloodImage._mask[1] !== FloodImage._bgColor) {
                FloodImage._direction = ((FloodImage._direction + 2) % 4) + 1
                FloodImage.setMask()
            } else if (FloodImage._mask[3] !== FloodImage._bgColor) {
                FloodImage.stepForward()
            } else if (
                (FloodImage._mask[1] === FloodImage._bgColor && FloodImage._mask[2] !== FloodImage._bgColor && FloodImage._mask[4] === FloodImage._bgColor) ||
                (FloodImage._mask[0] !== FloodImage._bgColor && FloodImage._mask[1] === FloodImage._bgColor && FloodImage._mask[3] === FloodImage._bgColor) ||
                (FloodImage._mask[3] === FloodImage._bgColor && FloodImage._mask[5] !== FloodImage._bgColor && FloodImage._mask[6] === FloodImage._bgColor) ||
                (FloodImage._mask[4] === FloodImage._bgColor && FloodImage._mask[6] === FloodImage._bgColor && FloodImage._mask[7] !== FloodImage._bgColor)
            ) {
                FloodImage.stepForward()
            } else {
                FloodImage.fillAndStep()
            }   // if (...)
        }   // while (true)
    }   // flood()

    private static fillAndStep(): void {
        FloodImage._loopMode = 0
        FloodImage._img.setPixel(FloodImage._nowX, FloodImage._nowY, FloodImage._color)
        switch (FloodImage._direction) {
            case 1:
                FloodImage._nowY--
                break

            case 2:
                FloodImage._nowX++
                break

            case 3:
                FloodImage._nowY++
                break

            case 4:
                FloodImage._nowX--
                break
        }   // switch (direction)

        FloodImage.setMask()
    }   // fillAndStep()

    private static getPixel(x: number, y: number): number {
        if (x < 0 || y < 0 || x >= FloodImage._img.width || y >= FloodImage._img.height) {
            return -1
        } else {
            return FloodImage._img.getPixel(x, y)
        }   // if (x < 0 || ...)
    }   // getPixel()

    private static setMask(): void {
        switch (FloodImage._direction) {
            case 1:
                FloodImage._mask[0] = FloodImage.getPixel(FloodImage._nowX - 1, FloodImage._nowY - 1)
                FloodImage._mask[1] = FloodImage.getPixel(FloodImage._nowX, FloodImage._nowY - 1)
                FloodImage._mask[2] = FloodImage.getPixel(FloodImage._nowX + 1, FloodImage._nowY - 1)
                FloodImage._mask[3] = FloodImage.getPixel(FloodImage._nowX - 1, FloodImage._nowY)
                FloodImage._mask[4] = FloodImage.getPixel(FloodImage._nowX + 1, FloodImage._nowY)
                FloodImage._mask[5] = FloodImage.getPixel(FloodImage._nowX - 1, FloodImage._nowY + 1)
                FloodImage._mask[6] = FloodImage.getPixel(FloodImage._nowX, FloodImage._nowY + 1)
                FloodImage._mask[7] = FloodImage.getPixel(FloodImage._nowX + 1, FloodImage._nowY + 1)
                break

            case 2:
                FloodImage._mask[0] = FloodImage.getPixel(FloodImage._nowX + 1, FloodImage._nowY - 1)
                FloodImage._mask[1] = FloodImage.getPixel(FloodImage._nowX + 1, FloodImage._nowY)
                FloodImage._mask[2] = FloodImage.getPixel(FloodImage._nowX + 1, FloodImage._nowY + 1)
                FloodImage._mask[3] = FloodImage.getPixel(FloodImage._nowX, FloodImage._nowY - 1)
                FloodImage._mask[4] = FloodImage.getPixel(FloodImage._nowX, FloodImage._nowY + 1)
                FloodImage._mask[5] = FloodImage.getPixel(FloodImage._nowX - 1, FloodImage._nowY - 1)
                FloodImage._mask[6] = FloodImage.getPixel(FloodImage._nowX - 1, FloodImage._nowY)
                FloodImage._mask[7] = FloodImage.getPixel(FloodImage._nowX - 1, FloodImage._nowY + 1)
                break

            case 3:
                FloodImage._mask[0] = FloodImage.getPixel(FloodImage._nowX + 1, FloodImage._nowY + 1)
                FloodImage._mask[1] = FloodImage.getPixel(FloodImage._nowX, FloodImage._nowY + 1)
                FloodImage._mask[2] = FloodImage.getPixel(FloodImage._nowX - 1, FloodImage._nowY + 1)
                FloodImage._mask[3] = FloodImage.getPixel(FloodImage._nowX + 1, FloodImage._nowY)
                FloodImage._mask[4] = FloodImage.getPixel(FloodImage._nowX - 1, FloodImage._nowY)
                FloodImage._mask[5] = FloodImage.getPixel(FloodImage._nowX + 1, FloodImage._nowY - 1)
                FloodImage._mask[6] = FloodImage.getPixel(FloodImage._nowX, FloodImage._nowY - 1)
                FloodImage._mask[7] = FloodImage.getPixel(FloodImage._nowX - 1, FloodImage._nowY - 1)
                break

            case 4:
                FloodImage._mask[0] = FloodImage.getPixel(FloodImage._nowX - 1, FloodImage._nowY + 1)
                FloodImage._mask[1] = FloodImage.getPixel(FloodImage._nowX - 1, FloodImage._nowY)
                FloodImage._mask[2] = FloodImage.getPixel(FloodImage._nowX - 1, FloodImage._nowY - 1)
                FloodImage._mask[3] = FloodImage.getPixel(FloodImage._nowX, FloodImage._nowY + 1)
                FloodImage._mask[4] = FloodImage.getPixel(FloodImage._nowX, FloodImage._nowY - 1)
                FloodImage._mask[5] = FloodImage.getPixel(FloodImage._nowX + 1, FloodImage._nowY + 1)
                FloodImage._mask[6] = FloodImage.getPixel(FloodImage._nowX + 1, FloodImage._nowY)
                FloodImage._mask[7] = FloodImage.getPixel(FloodImage._nowX + 1, FloodImage._nowY - 1)
        }   // switch (direction)
    }   // setMask()

    private static stepForward(): void {
        if (FloodImage._loopMode !== 0) {
            if (FloodImage._loopX === FloodImage._nowX && FloodImage._loopY === FloodImage._nowY) {
                if (FloodImage._loopDir === FloodImage._direction) {
                    FloodImage.fillAndStep()
                    return
                } else {
                    FloodImage._loopMode = 0
                    FloodImage._direction = FloodImage._loopDir
                }   // if (loopDir === direction)
            }   // if (loopX === nowX && loopY === nowY)
        } else {
            if (!
                (FloodImage._mask[3] !== FloodImage._bgColor && FloodImage._mask[4] === FloodImage._bgColor && FloodImage._mask[6] === FloodImage._bgColor) ||
                (FloodImage._mask[3] === FloodImage._bgColor && FloodImage._mask[4] !== FloodImage._bgColor && FloodImage._mask[6] === FloodImage._bgColor) ||
                (FloodImage._mask[3] === FloodImage._bgColor && FloodImage._mask[4] === FloodImage._bgColor && FloodImage._mask[6] === FloodImage._bgColor) ||
                (FloodImage._mask[3] === FloodImage._bgColor && FloodImage._mask[4] === FloodImage._bgColor && FloodImage._mask[6] !== FloodImage._bgColor)
            ) {
                FloodImage._loopMode = 1
                FloodImage._loopX = FloodImage._nowX
                FloodImage._loopY = FloodImage._nowY
                FloodImage._loopDir = FloodImage._direction
            }   // if (! ...)
        }   // if (loopMode)

        switch (FloodImage._direction) {
            case 1:
                FloodImage._nowY--
                break

            case 2:
                FloodImage._nowX++
                break

            case 3:
                FloodImage._nowY++
                break

            case 4:
                FloodImage._nowX--
                break
        }   // switch (direction)

        FloodImage.setMask()
    }   // stepForward()
}   // class FloodImage
