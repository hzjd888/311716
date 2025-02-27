// Photoshop 2025 智能分色脚本 v5.0
// 最后更新：2024年3月25日

// ====== 环境检测 ======
var PS_VERSION = parseFloat(app.version);
var IS_2025 = PS_VERSION >= 25.0;
var SUPPORT_PANTONE = true; // 是否启用Pantone映射

// ====== 配置参数 ======
var CONFIG = {
    colors: 6,                  // 分色数量（2-12）
    dither: 20,                 // 抖动强度（1-100）
    minStroke: 0.3,             // 最小线宽（毫米）
    output: {
        path: Folder.desktop + "/分色输出/",
        format: IS_2025 ? "TIFF" : "PSD" // 新版优先TIFF
    },
    pantoneDB: {                // 常用Pantone映射
        "FF0000": "PANTONE 186 C",
        "00FF00": "PANTONE 802 C"
    }
};
// ====== 主程序 ======
if (IS_2025) {
    alert("通道opacity类型：" + typeof channels[0].opacity); // 应显示"object"
    alert("当前不透明度值：" + channels[0].opacity.value);   // 应显示数值
}

if (app.documents.length > 0) {
    var doc = app.activeDocument;
    try {
        prepareDocument(doc);
        var options = buildConversionOptions();
        executeColorConversion(doc, options);
        processChannels(doc);
        saveResults(doc);
        showSuccess();
    } catch(e) {
        handleError(e);
    }
} else {
    alert("❗ 请打开需要分色的图像文件");
}

// ====== 功能函数 ======
function prepareDocument(doc) {
    doc.changeMode(ChangeMode.RGBCOLOR);
    if (IS_2025) doc.smartSharpen(0, 0.3); // 新版智能锐化
}

function buildConversionOptions() {
    var opts = new IndexedConversionOptions();
    
    if (IS_2025) {
        // 2025+新版参数
        opts.palette = Palette.ADAPTIVE;
        opts.dither = DitherType.ERROR_DIFFUSION;
        opts.colorCount = CONFIG.colors;
        opts.transparency = false;
    } else {
        // 旧版兼容参数
        opts.palette = Palette.LOCALSELECTIVE;
        opts.dither = Dither.DIFFUSION;
        opts.colors = CONFIG.colors;
    }
    
    opts.ditherAmount = CONFIG.dither;
    return opts;
}

function executeColorConversion(doc, options) {
    doc.changeMode(ChangeMode.INDEXEDCOLOR, options);
}

function processChannels(doc) {
    var colorTable = doc.colorTable;
    var channels = [];
    
    colorTable.forEach(function(color, index) {
        var channel = createChannel(doc, color, index);
        if (channel) channels.push(channel);
    });
    
    if (IS_2025) {
        // 新版通道优化（2025兼容写法）
     channels.sort((a, b) => (b.opacity.value - a.opacity.value)); // 2025版需要访问value属性
        channels.forEach(ch => {
            ch.knockout = true;
            ch.opacity.value = Math.max(30, ch.opacity.value); // 确保最低30%不透明度
        });
    }
}

function createChannel(doc, color, index) {
    try {
        var channel = doc.channels.add();
        channel.name = getChannelName(color, index);
        
        selectColorRange(doc, color);
        channel.mergeSelection();
        
        if (IS_2025) {
            channel.inkDensity = 100; // 新版油墨密度设置
            channel.opacity.value = 100 - (index * 5); // 2025版必须通过value赋值
        }
        
        return channel;
    } catch(e) {
        logError("通道创建失败: " + e.message);
        return null;
    }
}

function getChannelName(color, index) {
    var hex = color.hexValue.replace("#","");
    return SUPPORT_PANTONE ? 
        (CONFIG.pantoneDB[hex] || `专色_${index + 1}`) :
        `Color_${index + 1}`;
}

function selectColorRange(doc, color) {
    var bounds = [
        [0, 0], 
        [doc.width, 0], 
        [doc.width, doc.height], 
        [0, doc.height]
    ];
    doc.selection.select(bounds, SelectionType.REPLACE, 0, false);
    doc.selection.colorRange(color, color);
}

function saveResults(doc) {
    var folder = new Folder(CONFIG.output.path);
    if (!folder.exists) folder.create();
    
    // TIFF输出
    var tiffFile = new File(folder + "/分色结果.tif");
    var tiffOpt = new TiffSaveOptions();
    tiffOpt.alphaChannels = true;
    doc.saveAs(tiffFile, tiffOpt);
    
    // 新版附加PDF报告
    if (IS_2025) {
        var pdfFile = new File(folder + "/工艺报告.pdf");
        var pdfOpt = new PDFSaveOptions();
        pdfOpt.preset = "Smallest File Size";
        doc.saveAs(pdfFile, pdfOpt);
    }
}

function showSuccess() {
    alert(`✅ 分色完成！
    输出位置：${CONFIG.output.path}
    通道数量：${CONFIG.colors}
    最小线宽：${CONFIG.minStroke}mm`);
}

function handleError(e) {
    var errorMsg = `⚠️ 错误代码 ${e.number}：
    ${e.message}
    发生位置：Line ${e.line}`;
    
    if (IS_2025) {
        var logFile = new File(CONFIG.output.path + "/error_log.txt");
        logFile.open("a");
        logFile.writeln(`[${new Date()}] ${errorMsg}`);
        logFile.close();
    }
    
    alert(errorMsg);
}

// ====== 实用工具 ======
function logError(message) {
    $.writeln(message);
}