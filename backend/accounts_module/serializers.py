"""Accounts Module Serializers"""
from rest_framework import serializers
from accounts_module.models import (CashAccount, CashTransaction, BankAccount, BankTransaction,
                                     Income, Expense, Cheque, Transfer, Transaction)


class CashAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = CashAccount
        fields = '__all__'
        read_only_fields = ['id', 'current_balance', 'created_at']


class CashTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CashTransaction
        fields = '__all__'
        read_only_fields = ['id', 'balance_after', 'created_at']


class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = '__all__'
        read_only_fields = ['id', 'current_balance', 'created_at']


class BankTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankTransaction
        fields = '__all__'
        read_only_fields = ['id', 'balance_after', 'created_at']


class IncomeSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        model = Income
        fields = '__all__'
        read_only_fields = ['id', 'receipt_number', 'created_by', 'created_at']

    def to_internal_value(self, data):
        if 'phone' in data and not data.get('donor_phone'):
            mutable_data = data.copy()
            mutable_data['donor_phone'] = mutable_data.get('phone')
            data = mutable_data
        return super().to_internal_value(data)


class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = '__all__'
        read_only_fields = ['id', 'expense_id', 'created_by', 'created_at']


class ChequeSerializer(serializers.ModelSerializer):
    bank_name = serializers.SerializerMethodField()

    class Meta:
        model = Cheque
        fields = '__all__'
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_bank_name(self, obj):
        return obj.bank_account.bank_name if obj.bank_account else ''


class TransferSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transfer
        fields = '__all__'
        read_only_fields = ['id', 'transfer_id', 'created_by', 'created_at']


class TransactionSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = '__all__'
        read_only_fields = ['id', 'transaction_id', 'created_by', 'created_at']

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by else ''
