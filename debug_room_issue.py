#!/usr/bin/env python3
"""
Debug test for room field issue - investigating "[object Object]" problem
"""

import requests
import json

BACKEND_URL = "https://partymanager-1.preview.emergentagent.com/api"
TEST_CREDENTIALS = {"username": "admin", "password": "admin123"}

def debug_room_issue():
    session = requests.Session()
    
    # Authenticate
    response = session.post(f"{BACKEND_URL}/auth/login", json=TEST_CREDENTIALS)
    if response.status_code != 200:
        print("❌ Authentication failed")
        return
    
    token = response.json()['access_token']
    session.headers.update({'Authorization': f'Bearer {token}'})
    print("✅ Authenticated")
    
    # Get existing events to see room field
    response = session.get(f"{BACKEND_URL}/events")
    if response.status_code == 200:
        events = response.json()
        print(f"\n📋 Found {len(events)} events:")
        
        for i, event in enumerate(events[:3]):
            print(f"\nEvent {i+1}:")
            print(f"  ID: {event['id']}")
            print(f"  Client: {event['client_name']}")
            print(f"  Room field: {repr(event.get('room'))}")
            print(f"  Room type: {type(event.get('room'))}")
            
            # Try to understand what's in the room field
            room_value = event.get('room')
            if isinstance(room_value, str):
                print(f"  Room string length: {len(room_value)}")
                if room_value == "[object Object]":
                    print("  ❌ CRITICAL: Room field contains '[object Object]' - this is a JavaScript serialization error!")
                else:
                    try:
                        parsed = json.loads(room_value)
                        print(f"  Room parsed as JSON: {parsed}")
                    except:
                        print(f"  Room is not valid JSON")
    
    # Test creating a new event with proper room data
    print(f"\n🧪 Testing event creation with different room formats...")
    
    from datetime import datetime, timedelta
    future_date = (datetime.now() + timedelta(days=5)).strftime('%Y-%m-%d')
    
    # Test 1: String room
    test_event_1 = {
        "client_name": "Test Client 1",
        "birthday_person_name": "Test Child 1",
        "date": future_date,
        "start_time": "14:00",
        "end_time": "18:00",
        "room": "amarelo",  # String format
        "base_value": 500.00,
        "payment_status": "pending"
    }
    
    response = session.post(f"{BACKEND_URL}/events", json=test_event_1)
    if response.status_code == 200:
        event = response.json()
        print(f"✅ Event 1 created - Room: {repr(event.get('room'))}")
        event_1_id = event['id']
    else:
        print(f"❌ Event 1 failed: {response.status_code}")
        return
    
    # Test 2: Array room
    test_event_2 = {
        "client_name": "Test Client 2", 
        "birthday_person_name": "Test Child 2",
        "date": future_date,
        "start_time": "19:00",
        "end_time": "23:00",
        "room": ["amarelo", "laranja"],  # Array format
        "base_value": 800.00,
        "payment_status": "pending"
    }
    
    response = session.post(f"{BACKEND_URL}/events", json=test_event_2)
    if response.status_code == 200:
        event = response.json()
        print(f"✅ Event 2 created - Room: {repr(event.get('room'))}")
        event_2_id = event['id']
    else:
        print(f"❌ Event 2 failed: {response.status_code}")
        print(f"Response: {response.text}")
        return
    
    # Get the events back to see how they were stored
    print(f"\n🔍 Retrieving created events...")
    
    response = session.get(f"{BACKEND_URL}/events/{event_1_id}")
    if response.status_code == 200:
        event = response.json()
        print(f"Event 1 retrieved - Room: {repr(event.get('room'))}")
    
    response = session.get(f"{BACKEND_URL}/events/{event_2_id}")
    if response.status_code == 200:
        event = response.json()
        print(f"Event 2 retrieved - Room: {repr(event.get('room'))}")
    
    # Clean up
    session.delete(f"{BACKEND_URL}/events/{event_1_id}")
    session.delete(f"{BACKEND_URL}/events/{event_2_id}")
    print(f"\n🧹 Test events cleaned up")

if __name__ == "__main__":
    debug_room_issue()