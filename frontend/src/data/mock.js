export const ELECTION_DATE = new Date('2026-06-03T00:00:00');

export const PROVINCES = [
  { code: '11', name: '서울특별시',     short: '서울', party: 'blue' },
  { code: '26', name: '부산광역시',     short: '부산', party: 'red'  },
  { code: '27', name: '대구광역시',     short: '대구', party: 'red'  },
  { code: '28', name: '인천광역시',     short: '인천', party: 'blue' },
  { code: '29', name: '광주광역시',     short: '광주', party: 'blue' },
  { code: '30', name: '대전광역시',     short: '대전', party: 'blue' },
  { code: '31', name: '울산광역시',     short: '울산', party: 'red'  },
  { code: '36', name: '세종특별자치시', short: '세종', party: 'blue' },
  { code: '41', name: '경기도',         short: '경기', party: 'blue' },
  { code: '42', name: '강원특별자치도', short: '강원', party: 'red'  },
  { code: '43', name: '충청북도',       short: '충북', party: 'blue' },
  { code: '44', name: '충청남도',       short: '충남', party: 'blue' },
  { code: '45', name: '전북특별자치도', short: '전북', party: 'blue' },
  { code: '46', name: '전라남도',       short: '전남', party: 'blue' },
  { code: '47', name: '경상북도',       short: '경북', party: 'red'  },
  { code: '48', name: '경상남도',       short: '경남', party: 'red'  },
  { code: '50', name: '제주특별자치도', short: '제주', party: 'blue' },
];

export const NEWS = [
  { rank: 1, title: '수도권 초접전 양상… 민주당·국민의힘 오차범위 내 박빙', source: '연합뉴스', time: '1시간 전' },
  { rank: 2, title: '영남권, 국민의힘 강세 확인…PK 접전지 주목',             source: 'KBS',    time: '2시간 전' },
  { rank: 3, title: '전국 최종 투표율 61.4% 확정…전회 대비 +2.1%p',         source: 'MBC',    time: '3시간 전' },
  { rank: 4, title: '제3지대 후보, 수도권 5% 득표 예상…캐스팅보트 가능성',  source: '한겨레', time: '4시간 전' },
  { rank: 5, title: '강원 무소속 후보 이변 가능성…여야 긴장',               source: '조선일보',time: '5시간 전' },
];

export const POLYMARKET = [
  { title: '민주당 과반 달성',      volume: '$2M',   pct: 63, change: +7,  dir: 'up'   },
  { title: '국민의힘 수도권 선전',  volume: '$1M',   pct: 44, change: -4,  dir: 'down' },
  { title: '투표율 60% 초과',       volume: '$1.8M', pct: 78, change: +12, dir: 'up'   },
  { title: '제3당 원내 진입',       volume: '$0.9M', pct: 31, change: 0,   dir: 'flat' },
  { title: '무효표율 2% 초과',      volume: '$0.4M', pct: 22, change: -2,  dir: 'down' },
];

export const CANDIDATE_DATA = [
  { region: '서울시장',   name: '김민준', party: '민주당',   partyKey: 'blue', age: 54, career: '전 서울시 부시장',    poll: 48 },
  { region: '서울시장',   name: '이준호', party: '국민의힘', partyKey: 'red',  age: 58, career: '전 국회의원',         poll: 45 },
  { region: '경기도지사', name: '박지현', party: '민주당',   partyKey: 'blue', age: 51, career: '현 경기도 경제부지사', poll: 54 },
  { region: '경기도지사', name: '최강민', party: '국민의힘', partyKey: 'red',  age: 56, career: '전 국토부 장관',       poll: 40 },
  { region: '부산시장',   name: '정태양', party: '국민의힘', partyKey: 'red',  age: 60, career: '현 부산시 부시장',     poll: 57 },
  { region: '부산시장',   name: '유승민', party: '민주당',   partyKey: 'blue', age: 49, career: '전 국회의원',         poll: 38 },
  { region: '인천시장',   name: '송혜경', party: '민주당',   partyKey: 'blue', age: 52, career: '현 인천시 정무부지사', poll: 52 },
  { region: '대구시장',   name: '권영진', party: '국민의힘', partyKey: 'red',  age: 62, career: '현 대구시의원',        poll: 71 },
];

export const AI_SUGGESTIONS = [
  '민주당 예상 의석수는?',
  '수도권 핵심 경합지역은?',
  '투표율이 결과에 미치는 영향',
  '역대 지방선거 결과 비교',
  '개표 완료 시간은?',
];

export const AI_QA = {
  '민주당 예상 의석수는?': '현재 출구조사를 종합하면 민주당은 광역단체장 기준 <strong>9~11석</strong>을 확보할 것으로 예상됩니다. 수도권(서울·경기·인천)에서 모두 우세를 보이며, 전라권은 압도적 강세입니다.',
  '수도권 핵심 경합지역은?': '수도권 내 핵심 경합지는 <strong>서울 강남·서초구, 경기 성남·용인, 인천 연수구</strong>입니다. 이 지역들은 전통적 국민의힘 강세지역이나 이번 선거에서 5% 이내 접전입니다.',
  '투표율이 결과에 미치는 영향': '이번 선거 최종 투표율은 <strong>61.4%</strong>로 전회 대비 2.1%p 상승했습니다. 일반적으로 투표율이 높을수록 민주당에 유리하며, 특히 20~30대 투표율 상승이 수도권 결과에 큰 영향을 미칩니다.',
};