"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { responsiveDialogStyle } from '../lib/theme';
import { DialogTitle } from './ui';

interface EmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  currentEmoji?: string;
}

// Food and cooking related emojis with descriptions
const FOOD_EMOJIS = [
  // Stores & Shopping
  { emoji: '🏪', description: 'convenience store' },
  { emoji: '🏬', description: 'department store' },
  { emoji: '🛒', description: 'shopping cart' },
  { emoji: '🛍️', description: 'shopping bags' },
  { emoji: '🎯', description: 'target' },
  { emoji: '🥬', description: 'leafy green store' },
  { emoji: '🏪', description: 'market' },
  { emoji: '🌽', description: 'farmers market' },
  // Fruits
  { emoji: '🍎', description: 'red apple' },
  { emoji: '🍐', description: 'pear' },
  { emoji: '🍊', description: 'orange' },
  { emoji: '🍋', description: 'lemon' },
  { emoji: '🍌', description: 'banana' },
  { emoji: '🍉', description: 'watermelon' },
  { emoji: '🍇', description: 'grapes' },
  { emoji: '🍓', description: 'strawberry' },
  { emoji: '🫐', description: 'blueberries' },
  { emoji: '🍒', description: 'cherries' },
  { emoji: '🍑', description: 'peach' },
  { emoji: '🥭', description: 'mango' },
  { emoji: '🍍', description: 'pineapple' },
  { emoji: '🥥', description: 'coconut' },
  { emoji: '🥝', description: 'kiwi' },
  { emoji: '🍅', description: 'tomato' },
  { emoji: '🥑', description: 'avocado' },
  // Vegetables
  { emoji: '🥬', description: 'leafy green' },
  { emoji: '🥒', description: 'cucumber' },
  { emoji: '🥦', description: 'broccoli' },
  { emoji: '🥕', description: 'carrot' },
  { emoji: '🧄', description: 'garlic' },
  { emoji: '🧅', description: 'onion' },
  { emoji: '🥔', description: 'potato' },
  { emoji: '🍠', description: 'sweet potato' },
  { emoji: '🥐', description: 'croissant' },
  { emoji: '🥯', description: 'bagel' },
  { emoji: '🍞', description: 'bread' },
  { emoji: '🥖', description: 'baguette' },
  { emoji: '🥨', description: 'pretzel' },
  { emoji: '🧀', description: 'cheese' },
  { emoji: '🥚', description: 'egg' },
  { emoji: '🍳', description: 'cooking' },
  { emoji: '🧈', description: 'butter' },
  // Meat & Fish
  { emoji: '🥩', description: 'steak' },
  { emoji: '🍗', description: 'poultry leg' },
  { emoji: '🍖', description: 'meat on bone' },
  { emoji: '🦴', description: 'bone' },
  { emoji: '🥓', description: 'bacon' },
  { emoji: '🍔', description: 'hamburger' },
  { emoji: '🍟', description: 'french fries' },
  { emoji: '🌭', description: 'hot dog' },
  { emoji: '🍿', description: 'popcorn' },
  { emoji: '🧂', description: 'salt' },
  // Seafood
  { emoji: '🦐', description: 'shrimp' },
  { emoji: '🦞', description: 'lobster' },
  { emoji: '🦀', description: 'crab' },
  { emoji: '🦑', description: 'squid' },
  { emoji: '🦪', description: 'oyster' },
  { emoji: '🐟', description: 'fish' },
  { emoji: '🐠', description: 'tropical fish' },
  { emoji: '🐡', description: 'blowfish' },
  { emoji: '🦈', description: 'shark' },
  { emoji: '🐙', description: 'octopus' },
  // Grains & Legumes
  { emoji: '🌾', description: 'sheaf of rice' },
  { emoji: '🌱', description: 'seedling' },
  { emoji: '🌿', description: 'herb' },
  { emoji: '☘️', description: 'shamrock' },
  { emoji: '🍀', description: 'four leaf clover' },
  { emoji: '🌵', description: 'cactus' },
  { emoji: '🌴', description: 'palm tree' },
  { emoji: '🌳', description: 'deciduous tree' },
  { emoji: '🌲', description: 'evergreen tree' },
  { emoji: '🎋', description: 'tanabata tree' },
  { emoji: '🎍', description: 'pine decoration' },
  { emoji: '🎎', description: 'japanese dolls' },
  { emoji: '🎏', description: 'carp streamer' },
  { emoji: '🎐', description: 'wind chime' },
  { emoji: '🎀', description: 'ribbon' },
  { emoji: '🎁', description: 'wrapped gift' },
  // Herbs & Spices
  { emoji: '🌶️', description: 'hot pepper' },
  { emoji: '🫑', description: 'bell pepper' },
  // Dairy & Eggs
  { emoji: '🥛', description: 'glass of milk' },
  { emoji: '🍼', description: 'baby bottle' },
  { emoji: '🫖', description: 'teapot' },
  { emoji: '☕', description: 'hot beverage' },
  { emoji: '🍵', description: 'teacup without handle' },
  { emoji: '🧃', description: 'beverage box' },
  { emoji: '🥤', description: 'cup with straw' },
  { emoji: '🧋', description: 'bubble tea' },
  { emoji: '🍶', description: 'sake' },
  { emoji: '🍺', description: 'beer mug' },
  { emoji: '🍷', description: 'wine glass' },
  { emoji: '🥂', description: 'clinking glasses' },
  { emoji: '🥃', description: 'tumbler glass' },
  { emoji: '🍸', description: 'cocktail glass' },
  { emoji: '🍹', description: 'tropical drink' },
  { emoji: '🍻', description: 'clinking beer mugs' },
  // Desserts & Sweets
  { emoji: '🍦', description: 'soft ice cream' },
  { emoji: '🍧', description: 'shaved ice' },
  { emoji: '🍨', description: 'ice cream' },
  { emoji: '🍩', description: 'doughnut' },
  { emoji: '🍪', description: 'cookie' },
  { emoji: '🎂', description: 'birthday cake' },
  { emoji: '🧁', description: 'cupcake' },
  { emoji: '🥧', description: 'pie' },
  { emoji: '🍰', description: 'shortcake' },
  // Cooking & Kitchen
  { emoji: '🍽️', description: 'fork and knife with plate' },
  { emoji: '🍴', description: 'fork and knife' },
  { emoji: '🥄', description: 'spoon' },
  { emoji: '🔪', description: 'kitchen knife' },
  { emoji: '🏺', description: 'amphora' },
  { emoji: '⚱️', description: 'jar' },
  // International Cuisine
  { emoji: '🍕', description: 'pizza' },
  { emoji: '🌮', description: 'taco' },
  { emoji: '🌯', description: 'burrito' },
  { emoji: '🥙', description: 'stuffed flatbread' },
  { emoji: '🥪', description: 'sandwich' },
  { emoji: '🥗', description: 'green salad' },
  { emoji: '🥘', description: 'paella' },
  { emoji: '🥫', description: 'canned food' },
  { emoji: '🍝', description: 'spaghetti' },
  { emoji: '🍜', description: 'steaming bowl' },
  { emoji: '🍲', description: 'pot of food' },
  { emoji: '🍛', description: 'curry and rice' },
  { emoji: '🍣', description: 'sushi' },
  { emoji: '🍱', description: 'bento box' },
  { emoji: '🥟', description: 'dumpling' },
  { emoji: '🍤', description: 'fried shrimp' },
  { emoji: '🍙', description: 'rice ball' },
  { emoji: '🍚', description: 'cooked rice' },
  { emoji: '🍘', description: 'rice cracker' },
  { emoji: '🍥', description: 'fish cake with swirl' },
  { emoji: '🥠', description: 'fortune cookie' },
  { emoji: '🍡', description: 'dango' },
  // Breakfast
  { emoji: '🥞', description: 'pancakes' },
  { emoji: '🧇', description: 'waffle' },
  // Snacks
  { emoji: '🍿', description: 'popcorn' },
  // Special Occasions
  { emoji: '🎂', description: 'birthday cake' },
  { emoji: '🧁', description: 'cupcake' },
  { emoji: '🥧', description: 'pie' },
  { emoji: '🍰', description: 'shortcake' },
];

export default function EmojiPicker({ open, onClose, onSelect, currentEmoji }: EmojiPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEmojis = FOOD_EMOJIS.filter(item => 
    item.emoji.includes(searchTerm) || 
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    searchTerm === ''
  );

  const handleEmojiSelect = (emoji: string) => {
    onSelect(emoji);
    onClose();
    setSearchTerm('');
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      sx={responsiveDialogStyle}
    >
      <DialogTitle onClose={onClose}>
        <Typography variant="h6">Choose an Emoji</Typography>
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          placeholder="Search emojis..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          margin="normal"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
        
        <Box sx={{ mt: 2, maxHeight: 400, overflow: 'auto' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))',
              gap: 1,
            }}
          >
            {filteredEmojis.map((item, index) => (
              <Box
                key={index}
                onClick={() => handleEmojiSelect(item.emoji)}
                sx={{
                  fontSize: '2rem',
                  cursor: 'pointer',
                  p: 1,
                  borderRadius: 1,
                  textAlign: 'center',
                  border: currentEmoji === item.emoji ? '2px solid #1976d2' : '2px solid transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.1)',
                  },
                }}
                title={item.description}
              >
                {item.emoji}
              </Box>
            ))}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
} 