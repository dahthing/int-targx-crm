-- reset-demo.sql
-- Remove dados de demonstração mantendo configuração e utilizadores reais

delete from commissions where project_id like 'p1000000%';
delete from project_tranches where project_id like 'p1000000%';
delete from projects where id like 'p1000000%';
delete from lead_activities where lead_id like 'b1000000%';
delete from leads where id like 'b1000000%';
delete from clients where id like 'a1000000%';
delete from objection_playbook where tags && ARRAY['preço','prazo','integração','concorrência'];
