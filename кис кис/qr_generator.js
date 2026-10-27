// Компактный генератор QR-кодов (qrcode-generator by Kazuhiko Arase, MIT)
// Обёртка: возвращает data URL (PNG) для любого текста
function generateQR(text, size) {
  size = size || 200;
  try {
    // typeNumber 0 = автоопределение размера
    var qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    var count = qr.getModuleCount();
    var scale = Math.floor(size / count);
    if (scale < 1) scale = 1;
    var margin = 2;
    var totalSize = (count + margin * 2) * scale;

    var canvas = document.createElement('canvas');
    canvas.width = totalSize;
    canvas.height = totalSize;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalSize, totalSize);
    ctx.fillStyle = '#000000';
    for (var row = 0; row < count; row++) {
      for (var col = 0; col < count; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect((col + margin) * scale, (row + margin) * scale, scale, scale);
        }
      }
    }
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('QR generation error:', e);
    return null;
  }
}

// ═══ Минимальная библиотека qrcode-generator (MIT License) ═══
// Based on https://github.com/kazuhikoarase/qrcode-generator
function qrcode(typeNumber, errorCorrectionLevel) {
  var PAD0 = 0xEC, PAD1 = 0x11;
  var _typeNumber = typeNumber;
  var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
  var _modules = null;
  var _moduleCount = 0;
  var _dataCache = null;
  var _dataList = [];
  var _rsBlocks = null;

  var _this = {};
  _this.make = function() {
    if (_typeNumber < 1) {
      var typeNumber = 1;
      for (; typeNumber < 40; typeNumber++) {
        var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
        var buffer = QRBitBuffer();
        var totalDataCount = 0;
        for (var i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
        for (var i = 0; i < rsBlocks.length; i++) {
          var rsBlock = rsBlocks[i];
          buffer.put(rsBlock.data, rsBlock.data.length);
        }
        var totalDataCountBits = totalDataCount * 8;
        var dataLengthBits = buffer.getLengthInBits();
        if (dataLengthBits <= totalDataCountBits) break;
      }
      _typeNumber = typeNumber;
    }
    _makeImpl(false, _getBestMaskPattern());
  };

  _this.getModuleCount = function() { return _moduleCount; };
  _this.isDark = function(row, col) {
    if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
      throw new Error(row + ',' + col);
    }
    return _modules[row][col];
  };

  function _makeImpl(test, maskPattern) {
    _moduleCount = _typeNumber * 4 + 17;
    _modules = [];
    for (var row = 0; row < _moduleCount; row++) {
      _modules[row] = [];
      for (var col = 0; col < _moduleCount; col++) _modules[row][col] = null;
    }
    _setupPositionProbePattern(0, 0);
    _setupPositionProbePattern(_moduleCount - 7, 0);
    _setupPositionProbePattern(0, _moduleCount - 7);
    _setupPositionAdjustPattern();
    _setupTimingPattern();
    _setupTypeInfo(test, maskPattern);
    if (_typeNumber >= 7) _setupTypeNumber(test);
    if (_dataCache == null) _dataCache = _createData(_typeNumber, _errorCorrectionLevel);
    _mapData(_dataCache, maskPattern);
  }

  function _setupPositionProbePattern(row, col) {
    for (var r = -1; r <= 7; r++) {
      if (row + r <= -1 || _moduleCount <= row + r) continue;
      for (var c = -1; c <= 7; c++) {
        if (col + c <= -1 || _moduleCount <= col + c) continue;
        if ((0 <= r && r <= 6 && (c == 0 || c == 6)) || (0 <= c && c <= 6 && (r == 0 || r == 6)) || (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
          _modules[row + r][col + c] = true;
        } else {
          _modules[row + r][col + c] = false;
        }
      }
    }
  }

  function _setupTimingPattern() {
    for (var r = 8; r < _moduleCount - 8; r++) {
      if (_modules[r][6] != null) continue;
      _modules[r][6] = (r % 2 == 0);
    }
    for (var c = 8; c < _moduleCount - 8; c++) {
      if (_modules[6][c] != null) continue;
      _modules[6][c] = (c % 2 == 0);
    }
  }

  function _setupPositionAdjustPattern() {
    var pos = QRPatternUtil.getPatternPosition(_typeNumber);
    for (var i = 0; i < pos.length; i++) {
      for (var j = 0; j < pos.length; j++) {
        var row = pos[i], col = pos[j];
        if (_modules[row][col] != null) continue;
        for (var r = -2; r <= 2; r++) {
          for (var c = -2; c <= 2; c++) {
            if (r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0)) {
              _modules[row + r][col + c] = true;
            } else {
              _modules[row + r][col + c] = false;
            }
          }
        }
      }
    }
  }

  function _setupTypeNumber(test) {
    var bits = QRUtil.getBCHTypeNumber(_typeNumber);
    for (var i = 0; i < 18; i++) {
      var mod = (!test && ((bits >> i) & 1) == 1);
      _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
    }
    for (var i = 0; i < 18; i++) {
      var mod = (!test && ((bits >> i) & 1) == 1);
      _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
    }
  }

  function _setupTypeInfo(test, maskPattern) {
    var data = (_errorCorrectionLevel << 3) | maskPattern;
    var bits = QRUtil.getBCHTypeInfo(data);
    for (var i = 0; i < 15; i++) {
      var mod = (!test && ((bits >> i) & 1) == 1);
      if (i < 6) _modules[i][8] = mod;
      else if (i < 8) _modules[i + 1][8] = mod;
      else _modules[_moduleCount - 15 + i][8] = mod;
    }
    for (var i = 0; i < 15; i++) {
      var mod = (!test && ((bits >> i) & 1) == 1);
      if (i < 8) _modules[8][_moduleCount - i - 1] = mod;
      else if (i < 9) _modules[8][15 - i - 1 + 1] = mod;
      else _modules[8][15 - i - 1] = mod;
    }
    _modules[_moduleCount - 8][8] = (!test);
  }

  function _getBestMaskPattern() {
    var minLostPoint = 0, pattern = 0;
    for (var i = 0; i < 8; i++) {
      _makeImpl(true, i);
      var lostPoint = QRUtil.getLostPoint(_this);
      if (i == 0 || minLostPoint > lostPoint) {
        minLostPoint = lostPoint; pattern = i;
      }
    }
    return pattern;
  }

  function _mapData(data, maskPattern) {
    var inc = -1, row = _moduleCount - 1, bitIndex = 7, byteIndex = 0;
    var maskFunc = QRUtil.getMaskFunction(maskPattern);
    for (var col = _moduleCount - 1; col > 0; col -= 2) {
      if (col == 6) col--;
      while (true) {
        for (var c = 0; c < 2; c++) {
          if (_modules[row][col - c] == null) {
            var dark = false;
            if (byteIndex < data.length) {
              dark = (((data[byteIndex] >>> bitIndex) & 1) == 1);
            }
            var mask = maskFunc(row, col - c);
            if (mask) dark = !dark;
            _modules[row][col - c] = dark;
            bitIndex--;
            if (bitIndex == -1) { byteIndex++; bitIndex = 7; }
          }
        }
        row += inc;
        if (row < 0 || _moduleCount <= row) {
          row -= inc; inc = -inc; break;
        }
      }
    }
  }

  function _createData(typeNumber, errorCorrectionLevel) {
    var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);
    var buffer = QRBitBuffer();
    for (var i = 0; i < rsBlocks.length; i++) {
      var rsBlock = rsBlocks[i];
      buffer.put(rsBlock.data, rsBlock.data.length);
    }
    var totalDataCount = 0;
    for (var i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
    if (buffer.getLengthInBits() > totalDataCount * 8) throw new Error('code length overflow');
    return buffer;
  }

  var QRBitBuffer = function() {
    var _buffer = [], _length = 0;
    var _this = {};
    _this.getBuffer = function() { return _buffer; };
    _this.get = function(index) { var bufIndex = Math.floor(index / 8); return (((_buffer[bufIndex] >>> (7 - index % 8)) & 1) == 1); };
    _this.put = function(num, length) {
      for (var i = 0; i < length; i++) _this.putBit(((num >>> (length - i - 1)) & 1) == 1);
    };
    _this.getLengthInBits = function() { return _length; };
    _this.putBit = function(bit) {
      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) _buffer.push(0);
      if (bit) _buffer[bufIndex] |= (0x80 >>> (_length % 8));
      _length++;
    };
    return _this;
  };

  var QRErrorCorrectionLevel = { L: 1, M: 0, Q: 3, H: 2 };

  var QRRSBlock = {
    RS_BLOCK_TABLE: [],
    getRSBlocks: function(typeNumber, errorCorrectionLevel) {
      var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectionLevel);
      if (rsBlock == undefined) throw new Error('bad rs block');
      var length = rsBlock.length / 3, list = [];
      for (var i = 0; i < length; i++) {
        var count = rsBlock[i * 3 + 0], totalCount = rsBlock[i * 3 + 1], dataCount = rsBlock[i * 3 + 2];
        for (var j = 0; j < count; j++) list.push({ totalCount: totalCount, dataCount: dataCount, data: null });
      }
      return list;
    },
    getRsBlockTable: function(typeNumber, errorCorrectionLevel) {
      switch (errorCorrectionLevel) {
        case QRErrorCorrectionLevel.L: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
        case QRErrorCorrectionLevel.M: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
        case QRErrorCorrectionLevel.Q: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
        case QRErrorCorrectionLevel.H: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
        default: return undefined;
      }
    }
  };
  QRRSBlock.RS_BLOCK_TABLE = [
    [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
    [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
    [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
    [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
    [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
    [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
    [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
    [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
    [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
    [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16],
    [4, 101, 81], [1, 80, 50, 4, 81, 51], [4, 50, 22, 4, 51, 23], [3, 36, 12, 8, 37, 13],
    [2, 116, 92, 2, 117, 93], [6, 58, 36, 2, 59, 37], [4, 46, 20, 6, 47, 21], [7, 42, 14, 4, 43, 15],
    [4, 133, 107], [8, 59, 37, 1, 60, 38], [8, 44, 20, 4, 45, 21], [12, 33, 11, 4, 34, 12],
    [3, 145, 115, 1, 146, 116], [4, 64, 40, 5, 65, 41], [11, 36, 16, 5, 37, 17], [11, 36, 12, 5, 37, 13],
    [5, 109, 87, 1, 110, 88], [5, 65, 41, 5, 66, 42], [5, 54, 24, 7, 55, 25], [11, 36, 12],
    [5, 122, 98, 1, 123, 99], [7, 73, 45, 3, 74, 46], [15, 43, 19, 2, 44, 20], [3, 45, 15, 13, 46, 16],
    [1, 135, 107, 5, 136, 108], [10, 74, 46, 1, 75, 47], [1, 50, 22, 15, 51, 23], [2, 42, 14, 17, 43, 15],
    [5, 150, 120, 1, 151, 121], [9, 69, 43, 4, 70, 44], [17, 50, 22, 1, 51, 23], [2, 42, 14, 19, 43, 15],
    [3, 141, 113, 4, 142, 114], [3, 70, 44, 11, 71, 45], [17, 47, 21, 4, 48, 22], [9, 39, 13, 16, 40, 14],
    [3, 135, 107, 5, 136, 108], [3, 67, 41, 13, 68, 42], [15, 54, 24, 5, 55, 25], [15, 43, 15, 10, 44, 16],
    [4, 144, 116, 4, 145, 117], [17, 68, 42], [17, 50, 22, 6, 51, 23], [19, 46, 16, 6, 47, 17],
    [2, 139, 111, 7, 140, 112], [17, 74, 46], [7, 54, 24, 16, 55, 25], [34, 37, 13],
    [4, 151, 121, 5, 152, 122], [4, 75, 47, 14, 76, 48], [11, 54, 24, 14, 55, 25], [16, 45, 15, 14, 46, 16],
    [6, 147, 117, 4, 148, 118], [6, 73, 45, 14, 74, 46], [11, 54, 24, 16, 55, 25], [30, 46, 16, 2, 47, 17],
    [8, 132, 106, 4, 133, 107], [8, 75, 47, 13, 76, 48], [7, 54, 22, 22, 55, 23], [22, 45, 15, 13, 46, 16],
    [10, 142, 114, 2, 143, 115], [19, 74, 46, 4, 75, 47], [28, 50, 22, 6, 51, 23], [33, 46, 16, 4, 47, 17],
    [8, 152, 122, 4, 153, 123], [22, 73, 45, 3, 74, 46], [8, 53, 23, 26, 54, 24], [12, 45, 15, 28, 46, 16],
    [3, 147, 117, 10, 148, 118], [3, 73, 45, 23, 74, 46], [4, 54, 24, 31, 55, 25], [11, 45, 15, 31, 46, 16],
    [7, 146, 116, 7, 147, 117], [21, 73, 45, 7, 74, 46], [1, 53, 23, 37, 54, 24], [19, 45, 15, 26, 46, 16],
    [5, 145, 115, 10, 146, 116], [19, 75, 47, 10, 76, 48], [15, 54, 24, 25, 55, 25], [23, 45, 15, 25, 46, 16],
    [13, 145, 115, 3, 146, 116], [2, 74, 46, 29, 75, 47], [42, 54, 24, 1, 55, 25], [23, 45, 15, 28, 46, 16],
    [17, 145, 115], [10, 74, 46, 23, 75, 47], [10, 54, 24, 35, 55, 25], [19, 45, 15, 35, 46, 16],
    [17, 145, 115, 1, 146, 116], [14, 74, 46, 21, 75, 47], [29, 54, 24, 19, 55, 25], [11, 45, 15, 46, 46, 16],
    [13, 145, 115, 6, 146, 116], [14, 74, 46, 23, 75, 47], [44, 54, 24, 7, 55, 25], [59, 46, 16, 1, 47, 17],
    [12, 151, 121, 7, 152, 122], [12, 75, 47, 26, 76, 48], [39, 54, 24, 14, 55, 25], [22, 45, 15, 41, 46, 16],
    [6, 151, 121, 14, 152, 122], [6, 75, 47, 34, 76, 48], [46, 54, 24, 10, 55, 25], [2, 45, 15, 64, 46, 16],
    [17, 152, 122, 4, 153, 123], [29, 74, 46, 14, 75, 47], [49, 54, 24, 10, 55, 25], [24, 45, 15, 46, 46, 16],
    [4, 152, 122, 18, 153, 123], [13, 74, 46, 32, 75, 47], [48, 54, 24, 14, 55, 25], [42, 45, 15, 32, 46, 16],
    [20, 147, 117, 4, 148, 118], [40, 75, 47, 7, 76, 48], [43, 54, 24, 22, 55, 25], [10, 45, 15, 67, 46, 16],
    [19, 148, 118, 6, 149, 119], [18, 75, 47, 31, 76, 48], [34, 54, 24, 34, 55, 25], [20, 45, 15, 61, 46, 16]
  ];

  var QRUtil = {
    PATTERN000: 0, PATTERN001: 1, PATTERN010: 2, PATTERN011: 3,
    PATTERN100: 4, PATTERN101: 5, PATTERN110: 6, PATTERN111: 7,
    getPatternPosition: function(typeNumber) {
      var table = [
        [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42],
        [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66],
        [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86],
        [6, 34, 62, 90], [6, 26, 50, 74, 98], [6, 26, 52, 78, 102], [6, 30, 56, 82, 106],
        [6, 30, 58, 86, 110], [6, 34, 62, 90, 114], [6, 26, 52, 78, 102, 126], [6, 30, 56, 82, 106, 130],
        [6, 30, 58, 86, 110, 134], [6, 34, 62, 90, 114, 138], [6, 30, 58, 86, 110, 134, 158],
        [6, 34, 62, 90, 114, 138, 162], [6, 30, 58, 86, 110, 134, 158, 182], [6, 34, 62, 90, 114, 138, 162, 186],
        [6, 30, 58, 86, 110, 134, 158, 182, 196], [6, 34, 62, 90, 114, 138, 162, 186, 200],
        [6, 30, 58, 86, 110, 134, 158, 182, 196, 210], [6, 34, 62, 90, 114, 138, 162, 186, 200, 214],
        [6, 30, 58, 86, 110, 134, 158, 182, 196, 210, 224], [6, 34, 62, 90, 114, 138, 162, 186, 200, 214, 228],
        [6, 30, 58, 86, 110, 134, 158, 182, 196, 210, 224, 238], [6, 34, 62, 90, 114, 138, 162, 186, 200, 214, 228, 242],
        [6, 30, 58, 86, 110, 134, 158, 182, 196, 210, 224, 238, 252], [6, 34, 62, 90, 114, 138, 162, 186, 200, 214, 228, 242, 256],
        [6, 30, 58, 86, 110, 134, 158, 182, 196, 210, 224, 238, 252, 260], [6, 34, 62, 90, 114, 138, 162, 186, 200, 214, 228, 242, 256, 264],
        [6, 30, 58, 86, 110, 134, 158, 182, 196, 210, 224, 238, 252, 260, 268], [6, 34, 62, 90, 114, 138, 162, 186, 200, 214, 228, 242, 256, 264, 272],
        [6, 30, 58, 86, 110, 134, 158, 182, 196, 210, 224, 238, 252, 260, 268, 276], [6, 34, 62, 90, 114, 138, 162, 186, 200, 214, 228, 242, 256, 264, 272, 280],
        [6, 30, 58, 86, 110, 134, 158, 182, 196, 210, 224, 238, 252, 260, 268, 276, 284], [6, 34, 62, 90, 114, 138, 162, 186, 200, 214, 228, 242, 256, 264, 272, 280, 288],
        [6, 30, 58, 86, 110, 134, 158, 182, 196, 210, 224, 238, 252, 260, 268, 276, 284, 292], [6, 34, 62, 90, 114, 138, 162, 186, 200, 214, 228, 242, 256, 264, 272, 280, 288, 296],
        [6, 30, 58, 86, 110, 134, 158, 182, 196, 210, 224, 238, 252, 260, 268, 276, 284, 292, 300], [6, 34, 62, 90, 114, 138, 162, 186, 200, 214, 228, 242, 256, 264, 272, 280, 288, 296, 304],
        [6, 30, 58, 86, 110, 134, 158, 182, 196, 210, 224, 238, 252, 260, 268, 276, 284, 292, 300, 308], [6, 34, 62, 90, 114, 138, 162, 186, 200, 214, 228, 242, 256, 264, 272, 280, 288, 296, 304, 312],
        [6, 30, 58, 86, 110, 134, 158, 182, 196, 210, 224, 238, 252, 260, 268, 276, 284, 292, 300, 308, 316], [6, 34, 62, 90, 114, 138, 162, 186, 200, 214, 228, 242, 256, 264, 272, 280, 288, 296, 304, 312, 320],
        [6, 30, 58, 86, 110, 134, 158, 182, 196, 210, 224, 238, 252, 260, 268, 276, 284, 292, 300, 308, 316, 324], [6, 34, 62, 90, 114, 138, 162, 186, 200, 214, 228, 242, 256, 264, 272, 280, 288, 296, 304, 312, 320, 328]
      ];
      return table[typeNumber - 1];
    },
    getMaskFunction: function(maskPattern) {
      switch (maskPattern) {
        case 0: return function(i, j) { return (i + j) % 2 == 0; };
        case 1: return function(i, j) { return i % 2 == 0; };
        case 2: return function(i, j) { return j % 3 == 0; };
        case 3: return function(i, j) { return (i + j) % 3 == 0; };
        case 4: return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0; };
        case 5: return function(i, j) { return ((i * j) % 2) + ((i * j) % 3) == 0; };
        case 6: return function(i, j) { return (((i * j) % 2) + ((i * j) % 3)) % 2 == 0; };
        case 7: return function(i, j) { return (((i * j) % 3) + ((i + j) % 2)) % 2 == 0; };
        default: throw new Error('bad maskPattern: ' + maskPattern);
      }
    },
    getErrorCorrectPolynomial: function(errorCorrectPolynomial, errorCorrectLength) {
      var a = [1];
      for (var i = 0; i < errorCorrectLength; i++) {
        a = QRMath.g(a, [1, QRMath.gexp(i)]);
      }
      return a;
    },
    getLengthInBits: function(type, mode) {
      if (mode == QRMode.MODE_8BIT_BYTE) return type == 8 ? 8 : 16;
      return 0;
    },
    getLostPoint: function(qrCode) {
      var moduleCount = qrCode.getModuleCount();
      var lostPoint = 0;
      for (var row = 0; row < moduleCount; row++) {
        for (var col = 0; col < moduleCount; col++) {
          var sameCount = 0, dark = qrCode.isDark(row, col);
          for (var r = -1; r <= 1; r++) {
            if (row + r < 0 || moduleCount <= row + r) continue;
            if (dark == qrCode.isDark(row + r, col)) sameCount++;
          }
          for (var c = -1; c <= 1; c++) {
            if (col + c < 0 || moduleCount <= col + c) continue;
            if (dark == qrCode.isDark(row, col + c)) sameCount++;
          }
          if (sameCount > 5) lostPoint += (3 + sameCount - 5);
        }
      }
      return lostPoint;
    },
    getBCHTypeInfo: function(data) {
      var d = data << 10;
      var result = 0;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(result) >= 0) {
        result = (result << 1) | QRUtil.getBCHDigit(d) ^ QRUtil.getBCHDigit(result);
      }
      return ((data << 10) | result) ^ 0x5412;
    },
    getBCHTypeNumber: function(data) {
      var d = data << 12;
      var result = 0;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(result) >= 0) {
        result = (result << 1) | QRUtil.getBCHDigit(d) ^ QRUtil.getBCHDigit(result);
      }
      return ((data << 12) | result) ^ 0x5412;
    },
    getBCHDigit: function(data) {
      var digit = 0;
      while (data != 0) { digit++; data >>>= 1; }
      return digit;
    }
  };

  var QRMode = { MODE_8BIT_BYTE: 4 };

  var QRMath = {
    glog: function(n) {
      if (n < 1) throw new Error('glog(' + n + ')');
      return QRMath.LOG_TABLE[n];
    },
    gexp: function(n) {
      while (n < 0) n += 255;
      while (n >= 256) n -= 255;
      return QRMath.EXP_TABLE[n];
    },
    g: function(a, b) {
      if (a.length != b.length) throw new Error('g: ' + a.length + '!=' + b.length);
      var result = new Array(a.length);
      for (var i = 0; i < a.length; i++) result[i] = a[i] ^ b[i];
      return result;
    },
    EXP_TABLE: (function() {
      var table = new Array(256);
      for (var i = 0; i < 8; i++) table[i] = 1 << i;
      for (var i = 8; i < 256; i++) table[i] = table[i - 4] ^ table[i - 5] ^ table[i - 6] ^ table[i - 8];
      return table;
    })(),
    LOG_TABLE: (function() {
      var table = new Array(256);
      for (var i = 1; i < 256; i++) {
        var n = 0, x = i;
        while (x >= 256) { x >>>= 1; n++; }
        table[i] = n;
      }
      return table;
    })()
  };

  return _this;
}
