  export const COW_MANAGER_ABI = [
  "function addCow(string name) public",
  "function updateBehavior(uint256 cowId, uint8 newBehavior) public",
  "function getCow(uint256 id) public view returns (uint256 id, string name, uint8 currentBehavior, uint256 timestamp)",
  "function getCowHistory(uint256 id) public view returns (tuple(uint8 behavior, uint256 timestamp)[])",
  "function getAllCows() public view returns (tuple(uint256 id, string name, uint8 currentBehavior, uint256 timestamp, tuple(uint8 behavior, uint256 timestamp)[] history)[])",
  "function cowCount() public view returns (uint256)",
  "function owner() public view returns (address)",
  "function isDoctor(address doctor) public view returns (bool)",
  "function setDoctorStatus(address _doctor, bool _status) public",
  "function transferOwnership(address newOwner) public",
  "event CowAdded(uint256 indexed id, string name)",
  "event BehaviorUpdated(uint256 indexed cowId, uint8 newBehavior, uint256 time)"
];

export enum Behavior {
  Standing = 0,
  Eating = 1,
  Lying = 2
}

export const BehaviorLabels: Record<Behavior, string> = {
  [Behavior.Standing]: "Đang Đứng",
  [Behavior.Eating]: "Đang Ăn",
  [Behavior.Lying]: "Đang Nằm"
};

export const BehaviorColors: Record<Behavior, string> = {
  [Behavior.Standing]: "bg-blue-500",
  [Behavior.Eating]: "bg-green-500",
  [Behavior.Lying]: "bg-yellow-500"
};

export const BehaviorChartColors: Record<Behavior, string> = {
  [Behavior.Standing]: "#3b82f6",
  [Behavior.Eating]: "#22c55e",
  [Behavior.Lying]: "#eab308"
};
