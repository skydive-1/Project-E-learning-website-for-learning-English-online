const BRITISH_LANGUAGE_PATTERN = /^en[-_]GB$/i;

const PREFERRED_BRITISH_NAMES = [
  /Microsoft (?:Sonia|Ryan|Libby|Maisie)/i,
  /Google UK English/i,
  /(?:Daniel|Serena|Kate|Oliver)/i,
  /British/i,
  /English.*United Kingdom/i
];

// SpeechSynthesisVoice does not expose a standardized gender field. These
// patterns cover the common free en-GB voices bundled with major browsers/OSes.
const FEMALE_BRITISH_NAMES = /(?:Sonia|Libby|Maisie|Serena|Kate|Hazel|Susan|Google UK English Female)/i;
const MALE_BRITISH_NAMES = /(?:Ryan|Daniel|Oliver|George|Arthur|Google UK English Male)/i;

const getVoiceScore = (voice) => {
  const name = String(voice?.name || '');
  const preferredIndex = PREFERRED_BRITISH_NAMES.findIndex(pattern => pattern.test(name));
  let score = preferredIndex >= 0 ? 500 - (preferredIndex * 25) : 0;

  if (/natural|neural|enhanced|premium/i.test(name)) score += 80;
  if (voice?.default) score += 10;
  return score;
};

export const getPreferredBritishVoice = (speechSynthesis) => {
  if (!speechSynthesis?.getVoices) return null;

  const britishVoices = speechSynthesis
    .getVoices()
    .filter(voice => BRITISH_LANGUAGE_PATTERN.test(String(voice?.lang || '')))
    .sort((left, right) => getVoiceScore(right) - getVoiceScore(left));

  return britishVoices[0] || null;
};

export const getRandomBritishVoice = (speechSynthesis, random = Math.random) => {
  if (!speechSynthesis?.getVoices) return null;

  const britishVoices = speechSynthesis
    .getVoices()
    .filter(voice => BRITISH_LANGUAGE_PATTERN.test(String(voice?.lang || '')))
    .sort((left, right) => getVoiceScore(right) - getVoiceScore(left));

  if (britishVoices.length === 0) return null;

  const preferredVoices = britishVoices.filter(voice => getVoiceScore(voice) > 0);
  const candidateVoices = preferredVoices.length > 0 ? preferredVoices : britishVoices;
  const femaleVoices = candidateVoices.filter(voice => FEMALE_BRITISH_NAMES.test(String(voice?.name || '')));
  const maleVoices = candidateVoices.filter(voice => MALE_BRITISH_NAMES.test(String(voice?.name || '')));
  const genderPools = [femaleVoices, maleVoices].filter(pool => pool.length > 0);
  const selectedPool = genderPools.length > 0
    ? genderPools[Math.floor(random() * genderPools.length)]
    : candidateVoices;

  return selectedPool[Math.floor(random() * selectedPool.length)] || candidateVoices[0];
};

export const configureBritishEnglishUtterance = (
  utterance,
  speechSynthesis,
  { rate = 0.88, pitch = 1, random = Math.random } = {}
) => {
  if (!utterance) return utterance;

  utterance.lang = 'en-GB';
  utterance.rate = rate;
  utterance.pitch = pitch;

  const preferredVoice = getRandomBritishVoice(speechSynthesis, random);
  if (preferredVoice) utterance.voice = preferredVoice;

  return utterance;
};

export default configureBritishEnglishUtterance;
