// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract CowManager is Ownable {
    // 1. Định nghĩa các trạng thái của bò
    enum Behavior { Standing, Eating, Lying } // Đứng, Ăn, Nằm

    struct ActionLog {
        Behavior behavior;
        uint256 timestamp;
    }

    struct Cow {
        uint256 id;
        string name;
        Behavior currentBehavior;
        uint256 timestamp; // Thời gian cập nhật cuối cùng
        ActionLog[] history;
    }

    mapping(uint256 => Cow) private cows; // Lưu danh sách bò theo ID
    uint256 public cowCount;
    
    mapping(address => bool) public isDoctor;

    // Sự kiện
    event CowAdded(uint256 indexed id, string name);
    event BehaviorUpdated(uint256 indexed cowId, Behavior newBehavior, uint256 time);
    event DoctorStatusChanged(address indexed doctor, bool status);

    constructor() Ownable(msg.sender) {
        isDoctor[msg.sender] = true; // Chủ trang trại mặc định là bác sĩ
    }

    modifier onlyDoctor() {
        require(isDoctor[msg.sender] || owner() == msg.sender, "Chi bac si moi duoc phep cap nhat");
        _;
    }

    function setDoctorStatus(address _doctor, bool _status) public onlyOwner {
        isDoctor[_doctor] = _status;
        emit DoctorStatusChanged(_doctor, _status);
    }

    // Hàm thêm bò mới (Chỉ chủ trang trại làm) - Tiết kiệm gas bằng cách dùng calldata
    function addCow(string calldata _name) public onlyOwner {
        cowCount++;
        Cow storage newCow = cows[cowCount];
        newCow.id = cowCount;
        newCow.name = _name;
        newCow.currentBehavior = Behavior.Standing;
        newCow.timestamp = block.timestamp;
        
        newCow.history.push(ActionLog(Behavior.Standing, block.timestamp));
        
        emit CowAdded(cowCount, _name);
    }

    // Hàm cập nhật hành vi (Bác sĩ hoặc cảm biến gọi)
    function updateBehavior(uint256 _cowId, Behavior _newBehavior) public onlyDoctor {
        require(_cowId > 0 && _cowId <= cowCount, "Bo khong ton tai");
        
        cows[_cowId].currentBehavior = _newBehavior;
        cows[_cowId].timestamp = block.timestamp;
        cows[_cowId].history.push(ActionLog(_newBehavior, block.timestamp));
        
        emit BehaviorUpdated(_cowId, _newBehavior, block.timestamp);
    }

    // Lấy thông tin bò cơ bản
    function getCow(uint256 _id) public view returns (uint256 id, string memory name, Behavior currentBehavior, uint256 timestamp) {
        Cow storage c = cows[_id];
        return (c.id, c.name, c.currentBehavior, c.timestamp);
    }

    // Lấy lịch sử bò
    function getCowHistory(uint256 _id) public view returns (ActionLog[] memory) {
        return cows[_id].history;
    }

    // Lấy tất cả bò (Batch fetch để tối ưu Frontend)
    function getAllCows() public view returns (Cow[] memory) {
        Cow[] memory allCows = new Cow[](cowCount);
        for (uint256 i = 1; i <= cowCount; i++) {
            allCows[i-1] = cows[i];
        }
        return allCows;
    }
}
