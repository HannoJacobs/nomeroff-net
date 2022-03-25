const config = require('config'),
      fs = require('fs'),
      path = require('path'),
      jsonStore = require('../../app/helpers/jsonStore'),
      checkDir = require('../../app/helpers/checkDir'),
      checkDirStructure = require('../../app/helpers/checkDirStructure'),
      moveDatasetFiles = require('../../app/helpers/moveDatasetFiles'),
      joinAnnotationOcrDataset = require('../../app/helpers/joinAnnotationOcrDataset'),
      arrayShuffle = require('../../app/helpers/arrayShuffle'),
      sizeOf = require('image-size'),
      md5File = require('md5-file')


;


/**
 * @module controllers/defaultController
 */
async function index (options) {
    console.log('Hello world defaultController & index action with options: ' +JSON.stringify(options));
}


/**
 * Создание OCR-датасета Nomeroff Net
 *
 * @param options
 * @example ./console.js --section=default --action=createAnnotations  --baseDir=../../dataset/ocr/kz/kz2
 */
async function createAnnotations (options) {
        let baseDir = options.baseDir || config.dataset.baseDir;
        checkDir(baseDir);

        const imgPath = path.join(baseDir, config.dataset.img.dir),
              annPath = path.join(baseDir, config.dataset.ann.dir),
              imgExt = '.'+config.dataset.img.ext,
              tplPath = path.join(config.template.path, config.template.annDefault),
              annTrmplate = require(tplPath);
        checkDir(imgPath);
        checkDir(annPath,true);

        console.log(imgPath);
        fs.readdir(imgPath, async function(err, items) {
                for (let filename of items) {
                        const fileObj = path.parse(filename);
                        if (fileObj.ext === imgExt) {
                                const annFile = path.join(annPath, `${fileObj.name}.${config.dataset.ann.ext}`),
                                      imgFile = path.join(imgPath, filename),
                                      imgSize = sizeOf(imgFile);
                                let data = Object.assign(annTrmplate,{
                                        description: fileObj.name,
                                        name: fileObj.name,
                                        size: {
                                                width: imgSize.width,
                                                height: imgSize.height
                                        }
                                });
                                console.log(`Store ${annFile}`);
                                await jsonStore(annFile, data);
                        }
                }
        });
}

/**
 * Перенести в одельную папку из OCR-датасета промодеированные данные
 *
 * @param options
 * @example ./console.js --section=default --action=moveChecked  --opt.srcDir=../../datasets/ocr/kz/draft --opt.targetDir=../../datasets/ocr/kz/checked
 */
async function moveChecked (options) {
        const srcDir = options.srcDir || './draft',
              targetDir = options.targetDir || './checked',
              annExt = '.'+config.dataset.ann.ext,
              src = { annPath: path.join(srcDir, config.dataset.ann.dir) }
        ;
        let checkedAnn = [],
            checkedImg = []
        ;
        checkDirStructure(srcDir,[config.dataset.img.dir,config.dataset.ann.dir], true);
        checkDirStructure(targetDir, [config.dataset.img.dir,config.dataset.ann.dir], true);

        fs.readdir(src.annPath, async function(err, items) {
                for (let filename of items) {
                        const fileObj = path.parse(filename);
                        if (fileObj.ext === annExt) {
                                const annName = `${fileObj.name}.${config.dataset.ann.ext}`,
                                      annFileName = path.join( src.annPath, annName);
                                const data = require(path.isAbsolute(annFileName)?annFileName:path.join(process.cwd(),
                                                                                                        annFileName)),
                                      imgName = `${data.name}.${config.dataset.img.ext}`
                                ;
                                if (data.moderation !== undefined
                                    && data.moderation.isModerated !== undefined
                                    && data.moderation.isModerated) {
                                        checkedAnn.push(annName);
                                        checkedImg.push(imgName);
                                }
                        }
                }
                console.log(`Checked: ${checkedAnn.length}`);
                moveDatasetFiles({srcDir, targetDir, Anns: checkedAnn, Imgs: checkedImg, annDir:config.dataset.ann.dir, imgDir:config.dataset.img.dir, test:false});
        });
}

/**
 * Поделить датасет на 2 части в заданой пропорции (перенести из заданной папки в указанную с заданной пропорцией)
 *
 * @param options
 * @example ./console.js --section=default --action=dataSplit --opt.rate=0.2  --opt.srcDir=../../datasets/ocr/draft --opt.targetDir=../../datasets/ocr/test
 *          use opt.test=1 if you want emulate split process
 */
async function dataSplit (options) {
        const srcDir = options.srcDir || './train',
            targetDir = options.targetDir || './val',
            splitRate = options.rate || 0.2,
            testMode = options.test || false,
            annExt = '.'+config.dataset.ann.ext,
            src = { annPath: path.join(srcDir, config.dataset.ann.dir) }
        ;
        let checkedAnn = [],
            checkedImg = []
        ;

        checkDirStructure(srcDir,[config.dataset.img.dir,config.dataset.ann.dir], true);
        checkDirStructure(targetDir, [config.dataset.img.dir,config.dataset.ann.dir], true);

        fs.readdir(src.annPath, async function(err, items) {
                let sItems = arrayShuffle(items),
                    cnt = Math.round(sItems.length * splitRate),
                    itemsTest = sItems.slice(0,cnt);

                for (let i=0; i<itemsTest.length; i++) {
                        const  filename = items[i],
                               fileObj = path.parse(filename);
                        if (fileObj.ext === annExt) {
                                const annName = `${fileObj.name}.${config.dataset.ann.ext}`,
                                    annFileName = path.join( src.annPath, annName);
                                const data = require(path.isAbsolute(annFileName)?annFileName:path.join(process.cwd(),
                                                                                                        annFileName)),
                                    imgName = `${data.name}.${config.dataset.img.ext}`
                                ;
                                checkedAnn.push(annName);
                                checkedImg.push(imgName);
                        }
                }
                moveDatasetFiles({srcDir, targetDir, Anns: checkedAnn, Imgs: checkedImg, annDir:config.dataset.ann.dir, imgDir:config.dataset.img.dir, test:testMode});
                console.log(`All records: ${items.length}`);
                console.log(`Moved records: ${itemsTest.length}`);
        });
}


/**
 * Перенести в одельную папку "мусор" ("region_id": 0) из OCR-датасета
 *
 * @param options
 * @example ./console.js --section=default --action=moveGarbage  --opt.srcDir=../../datasets/ocr/kz/draft --opt.targetDir=../../datasets/ocr/kz/garbage
 */
async function moveGarbage (options) {
    const srcDir = options.srcDir || './draft',
        targetDir = options.targetDir || './checked',
        annExt = '.'+config.dataset.ann.ext,
        src = { annPath: path.join(srcDir, config.dataset.ann.dir) }
    ;
    let checkedAnn = [],
        checkedImg = []
    ;
    checkDirStructure(srcDir,[config.dataset.img.dir,config.dataset.ann.dir], true);
    checkDirStructure(targetDir, [config.dataset.img.dir,config.dataset.ann.dir], true);

    fs.readdir(src.annPath, async function(err, items) {
        for (let filename of items) {
            const fileObj = path.parse(filename);
            if (fileObj.ext === annExt) {
                const annName = `${fileObj.name}.${config.dataset.ann.ext}`,
                    annFileName = path.join( src.annPath, annName);
                const data = require(path.isAbsolute(annFileName)?annFileName:path.join(process.cwd(),
                                                                                        annFileName)),
                    imgName = `${data.name}.${config.dataset.img.ext}`
                ;
                if (data["region_id"] !== undefined && data["region_id"] === 0) {
                    checkedAnn.push(annName);
                    checkedImg.push(imgName);
                }
            }
        }
        console.log(`Garbage: ${checkedAnn.length}`);
        moveDatasetFiles({srcDir, targetDir, Anns: checkedAnn, Imgs: checkedImg, annDir:config.dataset.ann.dir, imgDir:config.dataset.img.dir, test:false});
    });
}

/**
 * Перенести в одельную что-либо по условию в тексте кода из OCR-датасета
 *
 * @param options
 * @example ./console.js --section=default --action=moveSomething  --opt.srcDir=/mnt/data/home/nn/datasets/autoriaNumberplateOptions3Dataset-2019-10-04/lnr --opt.targetDir=/mnt/data/home/nn/datasets/autoriaNumberplateOptions3Dataset-2019-10-04/lnr.true
 */
async function moveSomething (options) {
    const srcDir = options.srcDir || './draft',
        targetDir = options.targetDir || './checked',
        annExt = '.'+config.dataset.ann.ext,
        src = { annPath: path.join(srcDir, config.dataset.ann.dir) }
    ;
    let checkedAnn = [],
        checkedImg = []
    ;
    checkDirStructure(srcDir,[config.dataset.img.dir,config.dataset.ann.dir], true);
    checkDirStructure(targetDir, [config.dataset.img.dir,config.dataset.ann.dir], true);

    fs.readdir(src.annPath, async function(err, items) {
        for (let filename of items) {
            const fileObj = path.parse(filename);
            if (fileObj.ext === annExt) {
                const annName = `${fileObj.name}.${config.dataset.ann.ext}`,
                    annFileName = path.join( src.annPath, annName);
                const data = require(path.isAbsolute(annFileName)?annFileName:path.join(process.cwd(),
                                                                                        annFileName)),
                    imgName = `${data.name}.${config.dataset.img.ext}`
                ;

                if (data.size.height >= 32) {
                    checkedAnn.push(annName);
                    checkedImg.push(imgName);
                }
            }
        }
        console.log(`Garbage: ${checkedAnn.length}`);
        moveDatasetFiles({srcDir, targetDir, Anns: checkedAnn, Imgs: checkedImg, annDir:config.dataset.ann.dir, imgDir:config.dataset.img.dir, test:false});
    });
}


/**
 * Перенести дубликаты записай (по фото) в отдельную папку
 *
 * @param options
 * @example ./console.js --section=default --action=moveDupes --opt.srcDir=../../datasets/ocr/train --opt.targetDir=../../datasets/ocr/dupes
 */
async function moveDupes (options) {
    const srcDir = options.srcDir || './draft',
        targetDir = options.targetDir || './checked',
        annExt = '.'+config.dataset.ann.ext,
        src = { annPath: path.join(srcDir, config.dataset.ann.dir) },
        imgPath = path.join(srcDir, config.dataset.img.dir)
    ;
    let checkedAnn = [],
        checkedImg = []
    ;
    let checkSum = {}, checklogs = {};
    checkDirStructure(srcDir,[config.dataset.img.dir,config.dataset.ann.dir], true);
    checkDirStructure(targetDir, [config.dataset.img.dir,config.dataset.ann.dir], true);

    fs.readdir(src.annPath, async function(err, items) {
        for (let filename of items) {
            const  filename = items,
                fileObj = path.parse(filename);
            if (fileObj.ext === annExt) {
                const annName = `${fileObj.name}.${config.dataset.ann.ext}`,
                    annFileName = path.join( src.annPath, annName);
                const data = require(path.isAbsolute(annFileName)?annFileName:path.join(process.cwd(),
                                                                                        annFileName)),
                    imgName = `${data.name}.${config.dataset.img.ext}`
                ;
                let imgFullFile = path.join(imgPath, imgName),
                    imgSize = sizeOf(imgFullFile),
                    imgMd5 = await md5File(imgFullFile),
                    imgSizeHash = `${imgMd5}-${imgSize.width}x${imgSize.height}`;

                if (checkSum[imgSizeHash] !== undefined) {
                    checkedAnn.push(annName);
                    checkedImg.push(imgName);
                    if (checklogs[checkSum[imgSizeHash]] === undefined) {
                        checklogs[checkSum[imgSizeHash]] = []
                    }
                    checklogs[checkSum[imgSizeHash]].push(imgName)
                } else {
                    checkSum[imgSizeHash] = imgName;
                }
            }
        }
        console.log(`Garbage: ${checkedAnn.length}`);
        moveDatasetFiles({srcDir, targetDir, Anns: checkedAnn, Imgs: checkedImg, annDir:config.dataset.ann.dir, imgDir:config.dataset.img.dir, test:false});
        fs.writeFileSync('./logs.json', JSON.stringify(checklogs,null,2));
    });
}


/**
 * Склеить несколько папок в одну только для незакрашеных номеров
 *
 * @param options
 * @example ./console.js --section=default --action=dataJoin --opt.srcDir=/var/www/html2/js/nomeroff-net_2/datasets/ocr/ge2/ge  --opt.srcDir=/var/www/html2/js/nomeroff-net_2/datasets/ocr/ge2/ge.ok --opt.targetDir=/var/www/html2/js/nomeroff-net_2/datasets/ocr/ge2/target
 */
async function dataJoin (options) {
    if (options.srcDir !== undefined && Array.isArray(options.srcDir)) {
        throw new Error('"opt.srcJson" must be array for 2 (min) elements!')
    }
    const srcDir = options.srcDir,
        targetDir = options.targetDir || new Error('"opt.targetDir" is not defined!'),
        annExt = '.'+config.dataset.ann.ext
    ;
    for (let dir of srcDir) {
        checkDirStructure(dir,[config.dataset.img.dir,config.dataset.ann.dir]);
    }
    checkDirStructure(targetDir, [config.dataset.img.dir,config.dataset.ann.dir], true);
    joinAnnotationOcrDataset(srcDir, annExt)
}



module.exports = {
    index,
    createAnnotations,
    moveChecked,
    dataSplit,
    moveGarbage,
    dataJoin,
    moveSomething,
    moveDupes,
};