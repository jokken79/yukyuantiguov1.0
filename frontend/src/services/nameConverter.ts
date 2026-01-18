/**
 * 名前変換ユーティリティ
 * ローマ字名 → カタカナ変換
 * 日本語名はそのまま維持
 */

// 日本語文字かどうかを判定
export const isJapaneseName = (name: string): boolean => {
  // 漢字、ひらがな、カタカナが含まれているかチェック
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  return japaneseRegex.test(name);
};

// ローマ字 → カタカナ変換マッピング
const romajiToKatakana: { [key: string]: string } = {
  // 基本母音
  'a': 'ア', 'i': 'イ', 'u': 'ウ', 'e': 'エ', 'o': 'オ',

  // カ行
  'ka': 'カ', 'ki': 'キ', 'ku': 'ク', 'ke': 'ケ', 'ko': 'コ',
  'ca': 'カ', 'ci': 'シ', 'cu': 'ク', 'ce': 'セ', 'co': 'コ',

  // サ行
  'sa': 'サ', 'si': 'シ', 'su': 'ス', 'se': 'セ', 'so': 'ソ',
  'sha': 'シャ', 'shi': 'シ', 'shu': 'シュ', 'she': 'シェ', 'sho': 'ショ',

  // タ行
  'ta': 'タ', 'ti': 'チ', 'tu': 'トゥ', 'te': 'テ', 'to': 'ト',
  'tha': 'タ', 'thi': 'ティ', 'thu': 'トゥ', 'the': 'テ', 'tho': 'ト',
  'tsu': 'ツ', 'chi': 'チ', 'cha': 'チャ', 'chu': 'チュ', 'che': 'チェ', 'cho': 'チョ',

  // ナ行
  'na': 'ナ', 'ni': 'ニ', 'nu': 'ヌ', 'ne': 'ネ', 'no': 'ノ',
  'nha': 'ニャ', 'nhi': 'ニ', 'nhu': 'ニュ', 'nhe': 'ニェ', 'nho': 'ニョ',

  // ハ行
  'ha': 'ハ', 'hi': 'ヒ', 'hu': 'フ', 'he': 'ヘ', 'ho': 'ホ',
  'hua': 'ファ', 'hue': 'フエ', 'hui': 'フイ', 'huo': 'フオ',

  // マ行
  'ma': 'マ', 'mi': 'ミ', 'mu': 'ム', 'me': 'メ', 'mo': 'モ',

  // ヤ行
  'ya': 'ヤ', 'yi': 'イ', 'yu': 'ユ', 'ye': 'イェ', 'yo': 'ヨ',

  // ラ行
  'ra': 'ラ', 'ri': 'リ', 'ru': 'ル', 're': 'レ', 'ro': 'ロ',
  'la': 'ラ', 'li': 'リ', 'lu': 'ル', 'le': 'レ', 'lo': 'ロ',

  // ワ行
  'wa': 'ワ', 'wi': 'ウィ', 'wu': 'ウ', 'we': 'ウェ', 'wo': 'ヲ',

  // ン
  'n': 'ン', 'nn': 'ン', 'nm': 'ン', 'ng': 'ン',

  // ガ行
  'ga': 'ガ', 'gi': 'ギ', 'gu': 'グ', 'ge': 'ゲ', 'go': 'ゴ',
  'gia': 'ジャ', 'gie': 'ジェ', 'gio': 'ジョ', 'giu': 'ジュ',

  // ザ行
  'za': 'ザ', 'zi': 'ジ', 'zu': 'ズ', 'ze': 'ゼ', 'zo': 'ゾ',

  // ダ行
  'da': 'ダ', 'di': 'ディ', 'du': 'ドゥ', 'de': 'デ', 'do': 'ド',

  // バ行
  'ba': 'バ', 'bi': 'ビ', 'bu': 'ブ', 'be': 'ベ', 'bo': 'ボ',

  // パ行
  'pa': 'パ', 'pi': 'ピ', 'pu': 'プ', 'pe': 'ペ', 'po': 'ポ',
  'pha': 'ファ', 'phi': 'フィ', 'phu': 'フ', 'phe': 'フェ', 'pho': 'フォ',

  // ファ行 (外来語)
  'fa': 'ファ', 'fi': 'フィ', 'fu': 'フ', 'fe': 'フェ', 'fo': 'フォ',

  // ヴァ行
  'va': 'ヴァ', 'vi': 'ヴィ', 'vu': 'ヴ', 've': 'ヴェ', 'vo': 'ヴォ',

  // キャ行
  'kya': 'キャ', 'kyu': 'キュ', 'kyo': 'キョ',
  'kha': 'カ', 'khi': 'キ', 'khu': 'ク', 'khe': 'ケ', 'kho': 'コ',

  // シャ行
  'sya': 'シャ', 'syu': 'シュ', 'syo': 'ショ',

  // チャ行
  'tya': 'チャ', 'tyu': 'チュ', 'tyo': 'チョ',

  // ニャ行
  'nya': 'ニャ', 'nyu': 'ニュ', 'nyo': 'ニョ',

  // ヒャ行
  'hya': 'ヒャ', 'hyu': 'ヒュ', 'hyo': 'ヒョ',

  // ミャ行
  'mya': 'ミャ', 'myu': 'ミュ', 'myo': 'ミョ',

  // リャ行
  'rya': 'リャ', 'ryu': 'リュ', 'ryo': 'リョ',
  'lya': 'リャ', 'lyu': 'リュ', 'lyo': 'リョ',

  // ギャ行
  'gya': 'ギャ', 'gyu': 'ギュ', 'gyo': 'ギョ',

  // ジャ行
  'ja': 'ジャ', 'ji': 'ジ', 'ju': 'ジュ', 'je': 'ジェ', 'jo': 'ジョ',
  'jya': 'ジャ', 'jyu': 'ジュ', 'jyo': 'ジョ',

  // ビャ行
  'bya': 'ビャ', 'byu': 'ビュ', 'byo': 'ビョ',

  // ピャ行
  'pya': 'ピャ', 'pyu': 'ピュ', 'pyo': 'ピョ',

  // 特殊
  'qua': 'クア', 'que': 'ケ', 'qui': 'キ', 'quo': 'クオ',
  'quy': 'クイ',
  'xa': 'サ', 'xi': 'シ', 'xu': 'ス', 'xe': 'セ', 'xo': 'ソ',
  'xua': 'スア', 'xuan': 'スアン',

  // ベトナム語特有
  'tr': 'チ',
  'ph': 'フ', 'th': 'タ', 'kh': 'カ', 'gh': 'ガ',

  // 長音
  'aa': 'アー', 'ii': 'イー', 'uu': 'ウー', 'ee': 'エー', 'oo': 'オー',
  'ou': 'オウ', 'ei': 'エイ', 'ai': 'アイ', 'au': 'アウ', 'oi': 'オイ',
  'ie': 'イエ', 'uo': 'ウオ', 'ua': 'ウア', 'ue': 'ウエ',
  'ao': 'アオ', 'eo': 'エオ', 'io': 'イオ',

  // インドネシア語特有
  'sy': 'シ', 'ny': 'ニ',

  // ポルトガル語/スペイン語
  'lh': 'リ', 'rr': 'ル',
};

// ベトナム語の声調記号を除去
const removeVietnameseTones = (str: string): string => {
  const toneMap: { [key: string]: string } = {
    'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
    'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a', 'ă': 'a',
    'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a', 'â': 'a',
    'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
    'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e', 'ê': 'e',
    'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
    'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
    'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o', 'ô': 'o',
    'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o', 'ơ': 'o',
    'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
    'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u', 'ư': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
    'đ': 'd', 'Đ': 'd',
    'À': 'A', 'Á': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
    'Ằ': 'A', 'Ắ': 'A', 'Ẳ': 'A', 'Ẵ': 'A', 'Ặ': 'A', 'Ă': 'A',
    'Ầ': 'A', 'Ấ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A', 'Â': 'A',
    'È': 'E', 'É': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
    'Ề': 'E', 'Ế': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E', 'Ê': 'E',
    'Ì': 'I', 'Í': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
    'Ò': 'O', 'Ó': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
    'Ồ': 'O', 'Ố': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ộ': 'O', 'Ô': 'O',
    'Ờ': 'O', 'Ớ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O', 'Ơ': 'O',
    'Ù': 'U', 'Ú': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
    'Ừ': 'U', 'Ứ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U', 'Ư': 'U',
    'Ỳ': 'Y', 'Ý': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y',
  };

  return str.split('').map(char => toneMap[char] || char).join('');
};

// ⭐ NUEVO: Correcciones específicas para nombres comunes (especialmente vietnamitas)
const commonNameCorrections: { [key: string]: string } = {
  // Apellidos vietnamitas comunes
  'nguyen': 'グエン',
  'nguyễn': 'グエン',
  'tran': 'チャン',
  'trần': 'チャン',
  'le': 'レ',
  'lê': 'レ',
  'pham': 'ファム',
  'phạm': 'ファム',
  'hoang': 'ホアン',
  'huỳnh': 'フイン',
  'phan': 'ファン',
  'vu': 'ヴー',
  'vũ': 'ヴー',
  'vo': 'ヴォ',
  'võ': 'ヴォ',
  'dang': 'ダン',
  'đặng': 'ダン',
  'bui': 'ブイ',
  'bùi': 'ブイ',
  'do': 'ドー',
  'đỗ': 'ドー',
  'ngo': 'ゴー',
  'ngô': 'ゴー',
  'duong': 'ズオン',
  'dương': 'ズオン',

  // Nombres vietnamitas comunes
  'van': 'ヴァン',
  'văn': 'ヴァン',
  'thi': 'ティ',
  'thị': 'ティ',
  'anh': 'アイン',
  'minh': 'ミン',
  'thanh': 'タイン',
  'thành': 'タイン',
  'huy': 'フイ',
  'duc': 'ドゥック',
  'đức': 'ドゥック',
  'tuan': 'トゥアン',
  'tuấn': 'トゥアン',
  'hung': 'フン',
  'hùng': 'フン',
  'cuong': 'クオン',
  'cường': 'クオン',
  'hoai': 'ホアイ',
  'quang': 'クアン',

  // Apellidos brasileños/portugueses
  'silva': 'シルヴァ',
  'santos': 'サントス',
  'oliveira': 'オリヴェイラ',
  'souza': 'ソウザ',
  'rodrigues': 'ロドリゲス',
  'ferreira': 'フェレイラ',
  'alves': 'アウヴェス',
  'pereira': 'ペレイラ',
  'lima': 'リマ',
  'gomes': 'ゴメス',
  'costa': 'コスタ',
  'ribeiro': 'リベイロ',
  'martins': 'マルティンス',
  'carvalho': 'カルヴァーリョ',
  'rocha': 'ホシャ',
  'moura': 'モウラ',
  'araujo': 'アラウジョ',
  'barbosa': 'バルボーザ',
  'reis': 'ヘイス',
  'cardoso': 'カルドーゾ',
};

// 単語をカタカナに変換
const convertWordToKatakana = (word: string): string => {
  // ⭐ NUEVO: Primero verificar si es un nombre común con corrección específica
  const lowerWord = word.toLowerCase();
  if (commonNameCorrections[lowerWord]) {
    return commonNameCorrections[lowerWord];
  }
  let result = '';
  let i = 0;
  const lower = word.toLowerCase();

  while (i < lower.length) {
    let matched = false;

    // 3文字、2文字、1文字の順でマッチを試みる
    for (let len = 4; len >= 1; len--) {
      const substr = lower.slice(i, i + len);
      if (romajiToKatakana[substr]) {
        result += romajiToKatakana[substr];
        i += len;
        matched = true;
        break;
      }
    }

    // マッチしなかった場合
    if (!matched) {
      const char = lower[i];
      // 単一の子音が語尾にある場合
      if ('bcdfghjklmnpqrstvwxyz'.includes(char)) {
        if (i === lower.length - 1) {
          // 語尾の子音
          const consonantMap: { [key: string]: string } = {
            'n': 'ン', 'm': 'ム', 'ng': 'ン',
            'c': 'ク', 'k': 'ク', 'p': 'プ', 't': 'ト',
            'r': 'ル', 'l': 'ル', 's': 'ス', 'x': 'ス',
            'b': 'ブ', 'd': 'ド', 'g': 'グ', 'f': 'フ',
            'h': '', 'j': 'ジュ', 'v': 'ヴ', 'w': 'ウ',
            'y': 'イ', 'z': 'ズ', 'q': 'ク',
          };
          result += consonantMap[char] || '';
        } else {
          // 子音の後に母音が続く可能性を確認
          const nextChar = lower[i + 1];
          if ('aeiou'.includes(nextChar)) {
            // 次の反復で処理される
          }
        }
      }
      i++;
    }
  }

  return result;
};

// ⭐ NUEVO: Corrector de katakana mal escrito (nombres que ya vienen con errores del Excel)
const fixBrokenKatakana = (katakana: string): string => {
  let fixed = katakana;

  // Regla 1: Si empieza con "ン", agregar "グ" o cambiar por nombre correcto
  // Ejemplo: "ンウイェン" → "グエン"
  const brokenToFixed: { [key: string]: string } = {
    'ンウイェン': 'グエン',
    'ンウエン': 'グエン',
    'ンゲン': 'グエン',
    'ンガイエン': 'グエン',
  };

  // Primero intentar reemplazo directo de palabras completas
  Object.entries(brokenToFixed).forEach(([broken, correct]) => {
    fixed = fixed.replace(new RegExp(broken, 'g'), correct);
  });

  // Regla 2: Si aún empieza con "ン", agregar "グ" al inicio
  if (fixed.startsWith('ン')) {
    console.warn(`⚠️ Nombre con ン al inicio detectado: "${fixed}" → agregando グ`);
    fixed = 'グ' + fixed.substring(1);
  }

  // Regla 3: Correcciones de palabras específicas dentro del nombre
  const wordFixes: { [key: string]: string } = {
    'アン': 'ヴァン', // "An" → "Van" (cuando está en medio de nombre vietnamita)
  };

  // Solo aplicar si el nombre completo parece vietnamita (tiene otros indicadores)
  if (fixed.includes('グエン') || fixed.includes('チャン') || fixed.includes('ファム')) {
    // Reemplazar "アン" → "ヴァン" solo si NO es el primer componente
    const parts = fixed.split(/[・\s　]/);
    const correctedParts = parts.map((part, index) => {
      if (index > 0 && part === 'アン') {
        return 'ヴァン';
      }
      return part;
    });
    fixed = correctedParts.join('・');
  }

  return fixed;
};

// 名前全体を変換
export const convertNameToKatakana = (name: string): string => {
  // すでに日本語の場合は、まず修正を試みる
  if (isJapaneseName(name)) {
    // ⭐ NUEVO: Corregir katakana mal escrito
    return fixBrokenKatakana(name);
  }

  // ベトナム語の声調記号を除去
  const cleanName = removeVietnameseTones(name);

  // 特殊文字を除去（|など）
  const sanitizedName = cleanName.replace(/[|]/g, ' ');

  // 名前を空白で分割して各部分を変換
  const parts = sanitizedName.split(/\s+/).filter(p => p.length > 0);

  const convertedParts = parts.map(part => {
    // 既にカタカナの場合は修正を試みる
    if (/^[\u30A0-\u30FF]+$/.test(part)) {
      return fixBrokenKatakana(part);
    }

    return convertWordToKatakana(part);
  });

  return convertedParts.join('・'); // 中点で結合（より自然）
};

// 表示用の名前を取得
export const getDisplayName = (name: string): string => {
  return convertNameToKatakana(name);
};
