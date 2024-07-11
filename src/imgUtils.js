import { useEffect, useState } from 'react'

function preloadImage (src, cb) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = function() {
        cb(src)
      resolve(img)
    }
    img.onerror = img.onabort = function() {
        cb('error: ' + src)
      reject(src)
    }
    img.src = src
  })
}

export default function useImagePreloader(imageList) {
  const [imagesPreloaded, setImagesPreloaded] = useState(false)
  const [lastLoaded, setLastLoaded] = useState('');
  const [loadingError, setLoadingError] = useState('');

  useEffect(() => {
    let isCancelled = false

    async function effect() {
      //console.log('PRELOAD')

      if (isCancelled) {
        return
      }

      const imagesPromiseList = []
      for (const i of imageList) {
        imagesPromiseList.push(preloadImage(i, (p)=>setLastLoaded(p)))
      }
      
      try{
        await Promise.all(imagesPromiseList)
      }
      catch(e){
        console.log('error loading ' + e);
        setLoadingError(e)
      }

      if (isCancelled) {
        return
      }

      setLastLoaded('загрузка завершена')
      setTimeout(()=> setImagesPreloaded(true), 2000)
    }

    effect()

    return () => {
      isCancelled = true
    }
  }, [imageList])

  return { imagesPreloaded, lastLoaded, loadingError }
}

export const getTilesAndRacesImgs = (tiles) => {

    const result = [];
    tiles.forEach(tile => {
        if(tile && tile.tid && tile.tid !== -1){
            result.push('tiles/ST_' + tile.tid + '.png')

            if(tile.tdata && tile.tdata.type === 'green'){
                result.push('race/' + tile.tid + '.png');
                result.push('race/agent/' + tile.tid + '.png');
                result.push('race/commander/' + tile.tid + '.png');
                result.push('race/hero/' + tile.tid + '.png');
                result.push('race/icons/' + tile.tid + '.png');
            }
        }
    });

    return result;
}