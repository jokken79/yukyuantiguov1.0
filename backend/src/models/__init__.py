"""
Pydantic models for Yukyu Pro Backend
"""
from pydantic import BaseModel, Field
from typing import Optional, List


class PeriodHistory(BaseModel):
    """Employee leave period history"""
    periodIndex: int
    periodName: str
    elapsedMonths: int
    yukyuStartDate: str
    grantDate: str
    expiryDate: str
    granted: float
    used: float
    balance: float
    expired: float
    isExpired: bool
    isCurrentPeriod: bool
    yukyuDates: List[str] = []
    source: str
    syncedAt: str


class Employee(BaseModel):
    """Employee data model"""
    id: str
    employee_num: str = Field(alias="employeeNum")
    name: str
    haken: Optional[str] = None
    granted: float
    used: float
    balance: float
    usage_rate: float = Field(alias="usageRate")
    year: int
    periodHistory: Optional[List[PeriodHistory]] = None
    yukyuDates: Optional[List[str]] = None

    class Config:
        populate_by_name = True


class LeaveRecord(BaseModel):
    """Leave record data model"""
    id: str
    employeeId: str
    date: str
    type: str
    duration: str
    note: Optional[str] = None
    status: str
    createdAt: str
