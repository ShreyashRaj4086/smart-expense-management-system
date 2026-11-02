from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Date, DateTime, 
    ForeignKey, Text, UniqueConstraint, CheckConstraint, Index
)
from sqlalchemy.orm import relationship
from .database import Base

class Category(Base):
    __tablename__ = "categories"

    category_id = Column(Integer, primary_key=True, autoincrement=True)
    category_name = Column(String(100), unique=True, nullable=False)
    parent_category_id = Column(Integer, ForeignKey("categories.category_id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Self-referential relationship
    parent = relationship("Category", remote_side=[category_id], backref="subcategories")
    transactions = relationship("Transaction", back_populates="category")
    receipt_items = relationship("ReceiptItem", back_populates="category")
    budgets = relationship("Budget", back_populates="category", cascade="all, delete-orphan")


class Merchant(Base):
    __tablename__ = "merchants"

    merchant_id = Column(Integer, primary_key=True, autoincrement=True)
    merchant_name = Column(String(150), nullable=False)
    normalized_name = Column(String(150), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    transactions = relationship("Transaction", back_populates="merchant")


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    payment_method_id = Column(Integer, primary_key=True, autoincrement=True)
    method_name = Column(String(50), unique=True, nullable=False)

    transactions = relationship("Transaction", back_populates="payment_method")


class Transaction(Base):
    __tablename__ = "transactions"

    transaction_id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_date = Column(Date, nullable=False, index=True)
    amount_paise = Column(Integer, nullable=False)
    transaction_type = Column(String(20), default="expense", nullable=False)  # expense, income, refund
    description = Column(String(255), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.category_id", ondelete="SET NULL"), nullable=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.merchant_id", ondelete="SET NULL"), nullable=True, index=True)
    payment_method_id = Column(Integer, ForeignKey("payment_methods.payment_method_id", ondelete="RESTRICT"), nullable=False, index=True)
    source = Column(String(20), default="manual", nullable=False)  # manual or receipt
    notes = Column(Text, nullable=True)
    is_demo = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("amount_paise > 0", name="chk_positive_amount"),
        CheckConstraint("transaction_type IN ('expense', 'income', 'refund')", name="chk_transaction_type"),
        CheckConstraint("source IN ('manual', 'receipt')", name="chk_transaction_source"),
    )

    category = relationship("Category", back_populates="transactions")
    merchant = relationship("Merchant", back_populates="transactions")
    payment_method = relationship("PaymentMethod", back_populates="transactions")
    receipt = relationship("Receipt", back_populates="transaction", uselist=False, cascade="all, delete-orphan")


class Receipt(Base):
    __tablename__ = "receipts"

    receipt_id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(Integer, ForeignKey("transactions.transaction_id", ondelete="CASCADE"), unique=True, nullable=False)
    stored_path = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_hash = Column(String(64), nullable=False, index=True)  # SHA-256
    raw_ocr_text = Column(Text, nullable=True)
    extraction_status = Column(String(30), default="success", nullable=False)  # success, partial, failed, manual
    scanned_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    transaction = relationship("Transaction", back_populates="receipt")
    items = relationship("ReceiptItem", back_populates="receipt", cascade="all, delete-orphan")


class ReceiptItem(Base):
    __tablename__ = "receipt_items"

    item_id = Column(Integer, primary_key=True, autoincrement=True)
    receipt_id = Column(Integer, ForeignKey("receipts.receipt_id", ondelete="CASCADE"), nullable=False, index=True)
    item_name = Column(String(255), nullable=False)
    quantity = Column(Float, default=1.0, nullable=False)
    unit_price_paise = Column(Integer, nullable=True)
    line_total_paise = Column(Integer, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.category_id", ondelete="SET NULL"), nullable=True, index=True)
    confidence_score = Column(Float, nullable=True)

    __table_args__ = (
        CheckConstraint("line_total_paise >= 0", name="chk_non_negative_line_total"),
    )

    receipt = relationship("Receipt", back_populates="items")
    category = relationship("Category", back_populates="receipt_items")


class Budget(Base):
    __tablename__ = "budgets"

    budget_id = Column(Integer, primary_key=True, autoincrement=True)
    category_id = Column(Integer, ForeignKey("categories.category_id", ondelete="CASCADE"), nullable=False, index=True)
    month_start = Column(Date, nullable=False, index=True)  # First day of the budget month (YYYY-MM-01)
    budget_paise = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("category_id", "month_start", name="uq_category_month_budget"),
        CheckConstraint("budget_paise > 0", name="chk_positive_budget"),
    )

    category = relationship("Category", back_populates="budgets")
