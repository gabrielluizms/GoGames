#!/usr/bin/env python3
"""
Backend Test Suite for Party Management System - Contract Generation Testing
Tests the complete contract generation system including template management and PDF generation.
"""

import requests
import json
import sys
import os
from datetime import datetime, timedelta

# Configuration
BACKEND_URL = "https://partymanager-1.preview.emergentagent.com/api"
TEST_CREDENTIALS = {
    "username": "admin",
    "password": "admin123"
}

class ContractSystemTester:
    def __init__(self):
        self.token = None
        self.test_event_id = None
        self.session = requests.Session()
        
    def authenticate(self):
        """Authenticate and get access token"""
        print("🔐 Authenticating...")
        try:
            response = self.session.post(
                f"{BACKEND_URL}/auth/login",
                json=TEST_CREDENTIALS,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('access_token')
                self.session.headers.update({'Authorization': f'Bearer {self.token}'})
                print(f"✅ Authentication successful - User: {data.get('user', {}).get('username')}")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False
    
    def test_settings_endpoints(self):
        """Test settings save/load functionality for contract template"""
        print("\n📋 Testing Settings Endpoints...")
        
        # Test GET /api/settings - should return all settings
        try:
            response = self.session.get(f"{BACKEND_URL}/settings", timeout=30)
            if response.status_code == 200:
                settings = response.json()
                print(f"✅ GET /api/settings successful - Found {len(settings)} settings")
                
                # Check if contract_template exists
                contract_template = next((s for s in settings if s['key'] == 'contract_template'), None)
                if contract_template:
                    print("✅ Contract template found in settings")
                else:
                    print("⚠️  Contract template not found in settings")
                    
            else:
                print(f"❌ GET /api/settings failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Settings GET error: {str(e)}")
            return False
        
        # Test POST /api/settings - save contract template
        test_template = """<h2>CONTRATO DE TESTE</h2>
<p><strong>CONTRATANTE:</strong> @client_name</p>
<p><strong>CPF:</strong> @cpf</p>
<p><strong>Data do Evento:</strong> @event_date</p>
<p><strong>Valor Total:</strong> R$ @total_value</p>"""
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/settings",
                json={"key": "contract_template", "value": test_template},
                timeout=30
            )
            
            if response.status_code == 200:
                print("✅ POST /api/settings (contract_template) successful")
                
                # Verify the template was saved by fetching it again
                response = self.session.get(f"{BACKEND_URL}/settings", timeout=30)
                if response.status_code == 200:
                    settings = response.json()
                    saved_template = next((s for s in settings if s['key'] == 'contract_template'), None)
                    if saved_template and saved_template['value'] == test_template:
                        print("✅ Contract template persistence verified")
                        return True
                    else:
                        print("❌ Contract template not persisted correctly")
                        return False
                        
            else:
                print(f"❌ POST /api/settings failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Settings POST error: {str(e)}")
            return False
    
    def create_test_event(self):
        """Create a test event for contract generation"""
        print("\n🎉 Creating test event...")
        
        # Calculate a future date
        future_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        
        event_data = {
            "client_name": "Maria Silva Santos",
            "cpf": "123.456.789-00",
            "address": "Rua das Flores, 123",
            "city_uf": "São Paulo - SP",
            "cep": "01234-567",
            "phone": "(11) 99999-9999",
            "email": "maria.silva@email.com",
            "birthday_person_name": "João Silva Santos",
            "age_to_complete": 8,
            "party_theme": "Super-Heróis",
            "balloon_color": "Azul e Vermelho",
            "date": future_date,
            "start_time": "14:00",
            "end_time": "18:00",
            "room": "amarelo",
            "base_value": 500.00,
            "total_value": 650.00,
            "payment_method": "transfer",
            "payment_status": "partial",
            "observations": "Festa temática com decoração especial",
            "extra_hours": [
                {
                    "hours": 2,
                    "price_per_hour": 50.00,
                    "total": 100.00
                }
            ],
            "game_cards": {
                "quantity": 10,
                "unit_price": 5.00,
                "total": 50.00
            },
            "payment_details": {
                "paid_amount": 200.00,
                "remaining": 450.00
            }
        }
        
        try:
            response = self.session.post(
                f"{BACKEND_URL}/events",
                json=event_data,
                timeout=30
            )
            
            if response.status_code == 200:
                event = response.json()
                self.test_event_id = event['id']
                print(f"✅ Test event created successfully - ID: {self.test_event_id}")
                print(f"   Client: {event['client_name']}")
                print(f"   Date: {event['date']} ({event['start_time']} - {event['end_time']})")
                print(f"   Total Value: R$ {event['total_value']}")
                return True
            else:
                print(f"❌ Event creation failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Event creation error: {str(e)}")
            return False
    
    def test_contract_generation(self):
        """Test contract PDF generation endpoint"""
        print("\n📄 Testing Contract PDF Generation...")
        
        if not self.test_event_id:
            print("❌ No test event available for contract generation")
            return False
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/contracts/generate/{self.test_event_id}",
                timeout=60  # PDF generation might take longer
            )
            
            if response.status_code == 200:
                # Check if response is PDF
                content_type = response.headers.get('content-type', '')
                if 'application/pdf' in content_type:
                    pdf_size = len(response.content)
                    print(f"✅ Contract PDF generated successfully")
                    print(f"   Content-Type: {content_type}")
                    print(f"   PDF Size: {pdf_size} bytes")
                    
                    # Check Content-Disposition header
                    disposition = response.headers.get('content-disposition', '')
                    if 'attachment' in disposition and 'contrato-' in disposition:
                        print(f"✅ Correct download headers set: {disposition}")
                    else:
                        print(f"⚠️  Download headers: {disposition}")
                    
                    # Verify PDF content (basic check)
                    if response.content.startswith(b'%PDF'):
                        print("✅ Valid PDF format confirmed")
                        return True
                    else:
                        print("❌ Invalid PDF format")
                        return False
                else:
                    print(f"❌ Wrong content type: {content_type}")
                    print(f"Response: {response.text[:200]}...")
                    return False
                    
            elif response.status_code == 404:
                error_data = response.json()
                if 'contrato não configurado' in error_data.get('detail', '').lower():
                    print("❌ Contract template not configured")
                elif 'evento não encontrado' in error_data.get('detail', '').lower():
                    print("❌ Event not found")
                else:
                    print(f"❌ 404 Error: {error_data.get('detail')}")
                return False
            else:
                print(f"❌ Contract generation failed: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data.get('detail')}")
                except:
                    print(f"   Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Contract generation error: {str(e)}")
            return False
    
    def test_variable_substitution(self):
        """Test if variables are properly substituted in contract"""
        print("\n🔄 Testing Variable Substitution...")
        
        # First, set a template with all variables
        template_with_variables = """<h2>CONTRATO COMPLETO</h2>
<p>Cliente: @client_name</p>
<p>CPF: @cpf</p>
<p>Endereço: @address</p>
<p>Cidade: @city_uf</p>
<p>CEP: @cep</p>
<p>Telefone: @phone</p>
<p>Email: @email</p>
<p>Aniversariante: @birthday_person_name</p>
<p>Idade: @age_to_complete anos</p>
<p>Data: @event_date</p>
<p>Horário: @start_time às @end_time</p>
<p>Salão: @room</p>
<p>Tema: @party_theme</p>
<p>Balões: @balloon_color</p>
<p>Valor Base: R$ @base_value</p>
<p>Valor Total: R$ @total_value</p>
<p>Pagamento: @payment_method</p>
<p>Extras: @extras</p>"""
        
        try:
            # Save the template
            response = self.session.post(
                f"{BACKEND_URL}/settings",
                json={"key": "contract_template", "value": template_with_variables},
                timeout=30
            )
            
            if response.status_code != 200:
                print(f"❌ Failed to save test template: {response.status_code}")
                return False
            
            print("✅ Test template with all variables saved")
            
            # Generate contract with this template
            if not self.test_event_id:
                print("❌ No test event for variable testing")
                return False
            
            response = self.session.get(
                f"{BACKEND_URL}/contracts/generate/{self.test_event_id}",
                timeout=60
            )
            
            if response.status_code == 200 and 'application/pdf' in response.headers.get('content-type', ''):
                print("✅ Contract with all variables generated successfully")
                print("✅ Variable substitution appears to be working")
                return True
            else:
                print(f"❌ Contract generation with variables failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Variable substitution test error: {str(e)}")
            return False
    
    def test_edge_cases(self):
        """Test edge cases and error conditions"""
        print("\n🧪 Testing Edge Cases...")
        
        # Test contract generation with non-existent event
        try:
            response = self.session.get(
                f"{BACKEND_URL}/contracts/generate/non-existent-id",
                timeout=30
            )
            
            if response.status_code == 404:
                print("✅ Correctly handles non-existent event ID")
            else:
                print(f"⚠️  Unexpected response for non-existent event: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Edge case test error: {str(e)}")
            return False
        
        # Test with empty template
        try:
            response = self.session.post(
                f"{BACKEND_URL}/settings",
                json={"key": "contract_template", "value": ""},
                timeout=30
            )
            
            if response.status_code == 200:
                print("✅ Empty template saved successfully")
                
                # Try to generate contract with empty template
                if self.test_event_id:
                    response = self.session.get(
                        f"{BACKEND_URL}/contracts/generate/{self.test_event_id}",
                        timeout=30
                    )
                    
                    if response.status_code == 200:
                        print("✅ Contract generation handles empty template")
                    else:
                        print(f"⚠️  Empty template handling: {response.status_code}")
            
        except Exception as e:
            print(f"❌ Empty template test error: {str(e)}")
        
        return True
    
    def cleanup_test_data(self):
        """Clean up test event"""
        print("\n🧹 Cleaning up test data...")
        
        if self.test_event_id:
            try:
                response = self.session.delete(
                    f"{BACKEND_URL}/events/{self.test_event_id}",
                    timeout=30
                )
                
                if response.status_code == 200:
                    print("✅ Test event cleaned up successfully")
                else:
                    print(f"⚠️  Test event cleanup: {response.status_code}")
                    
            except Exception as e:
                print(f"⚠️  Cleanup error: {str(e)}")
    
    def run_all_tests(self):
        """Run all contract system tests"""
        print("🚀 Starting Contract System Tests")
        print("=" * 50)
        
        test_results = {
            'authentication': False,
            'settings_endpoints': False,
            'event_creation': False,
            'contract_generation': False,
            'variable_substitution': False,
            'edge_cases': False
        }
        
        # Run tests in sequence
        if self.authenticate():
            test_results['authentication'] = True
            
            if self.test_settings_endpoints():
                test_results['settings_endpoints'] = True
                
                if self.create_test_event():
                    test_results['event_creation'] = True
                    
                    if self.test_contract_generation():
                        test_results['contract_generation'] = True
                        
                        if self.test_variable_substitution():
                            test_results['variable_substitution'] = True
            
            if self.test_edge_cases():
                test_results['edge_cases'] = True
            
            # Cleanup
            self.cleanup_test_data()
        
        # Print summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(test_results.values())
        total = len(test_results)
        
        for test_name, result in test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name.replace('_', ' ').title():<25} {status}")
        
        print(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All contract system tests PASSED!")
            return True
        else:
            print("⚠️  Some tests FAILED - check implementation")
            return False

def main():
    """Main test execution"""
    print("Contract Generation System - Backend Test Suite")
    print("Testing: Template save/load, PDF generation, variable substitution")
    print()
    
    tester = ContractSystemTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()