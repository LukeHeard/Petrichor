
import re

def std(s): return s.lower().replace(" ", "-").replace("_", "-")
def get_words(s): return set(re.findall(r'[a-z0-9]+', s.lower()))

def clean_tags(tags, ignore_tags):
    cleaned_tags = []
    seen_words = set()
    
    # Sort by length so we process shorter, more fundamental tags first
    sorted_tags = sorted(list(dict.fromkeys(tags)), key=len)
    
    for t in sorted_tags:
        s_t = std(t)
        if s_t in ignore_tags:
            continue
        
        t_words = get_words(t)
        if not t_words:
            continue
            
        print(f"Checking '{t}' (words: {t_words}) against seen: {seen_words}")
        if t_words.issubset(seen_words):
            print(f"  -> REDUNDANT")
            continue
        
        cleaned_tags.append(t)
        seen_words.update(t_words)
        print(f"  -> ACCEPTED. New seen: {seen_words}")
    
    final_tags = [t for t in tags if t in cleaned_tags]
    return final_tags

# Test cases
ignore = {"to-read", "read"}
test1 = ["Fantasy", "Science Fiction", "Science Fiction Fantasy"]
print(f"Test 1: {test1}")
print(f"Result 1: {clean_tags(test1, ignore)}")

test2 = ["Classics", "Fiction", "Literature", "Historical Fiction"]
print(f"\nTest 2: {test2}")
print(f"Result 2: {clean_tags(test2, ignore)}")
