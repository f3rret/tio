import { defineHex, Grid, spiral, ring, Orientation, line, fromCoordinates } from 'honeycomb-grid';

const Hex = defineHex({dimensions: 190, orientation: Orientation.FLAT});
//const mapArr = [18, 77, 80, 28, 50, 45, 70, 67, 20, 38, 23, 21, 66, 27, 29, 72, 46, 71, 48, 15, 40, 73, 54, 41, 24, 7, 30, 36, 9, 79, 25, 57, 39, 68, 55, 61, 76].reverse();
//const mapArr = [18, 30, 36, 24, '86A', 40, 77, 44, 25, 35, 39, 62, '88A', 33, '87A', 37, 22, 26, 78, 9, 65, 41, 14, 50, 66, 10, 41, '83A', '85A', '84A', 45, 5, 47, 27, 1, 46, 21].reverse();

function removeTrailing(tiles) {
    while(tiles[tiles.length - 1] === -1){
        tiles.pop();
    }
    return tiles;
}

export const getHexGrid = (arr) => {
    let mapArr = removeTrailing([...arr]);
    mapArr.reverse();
    
    console.log('mapArr:', mapArr);
    let HexGrid = new Grid(Hex, spiral({ start: [0, 0], radius: 3 }));
    HexGrid.forEach(hex => hex.tileId = mapArr.pop());
    return HexGrid;
}
export const neighbors = (HexGrid, c) => {
    const ringTraverser = ring({ center: c, radius: 1, bail: true })
    return HexGrid.traverse(ringTraverser);
}

export const lineTo = (HexGrid, {start, stop}) => {
    const lineBetween = line({ start, stop })
    return HexGrid.traverse(lineBetween);
}

export const pathFromCoordinates = (HexGrid, coords) => {
    const lineBetween = fromCoordinates(...coords)
    return HexGrid.traverse(lineBetween);
}